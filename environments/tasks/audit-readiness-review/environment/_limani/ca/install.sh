# Installs the task's simulated CA roots (the *.crt files beside this script)
# into an image's trust stores, the way that image's own tools do it.
#
# Service images: runs as root in a throwaway build stage on top of the
# service's image, with a static busybox mounted at /.limani-tools, so the
# image needs no shell or tools of its own. Every file it changes is copied
# to /.limani-out, which the next stage copies over the unchanged image.
# The player (LIMANI_CA_INPLACE=1): runs with the image's own shell and
# tools and changes the image in place.
#
# A root whose name a distribution ships (GTS Root R4, ISRG Root X2) replaces
# the real one rather than sitting beside it; any other goes where a local
# administrator puts one. The store is found by what exists, not by
# /etc/os-release: python:alpine has update-ca-certificates, redis:alpine
# only a bundle. An image with no store at all (scratch, busybox, slim
# images without ca-certificates) is left alone, like the real machine,
# which couldn't verify a public site either, unless it has a JavaScript
# runtime, which verifies with roots of its own (see NODE_EXTRA_CA_CERTS
# below).
set -eu
CA=/.limani-ca
OUT=/.limani-out
TMP=/.limani-out.tmp
if [ -x /.limani-tools/bin/busybox ]; then bb=/.limani-tools/bin/busybox; else bb=; fi
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
inplace=${LIMANI_CA_INPLACE:-}
have() { command -v "$1" >/dev/null 2>&1; }
# label FILE: a root's name, from the labels file (FILE<TAB>NAME per line).
label() { $bb awk -F '\t' -v f="$1" '$1 == f { print $2 }' "$CA/labels"; }

$bb mkdir -p $TMP
SYS="/etc/ssl /etc/pki /usr/share/ca-certificates /usr/local/share/ca-certificates /etc/ca-certificates.conf"
snap() {
  for p in $SYS; do [ -e "$p" ] && $bb find "$p" \( -type f -o -type l \); done 2>/dev/null | $bb sort | while read -r f; do
    if [ -L "$f" ]; then echo "$f L $($bb readlink "$f")"; else echo "$f F $($bb md5sum < "$f" | $bb cut -d' ' -f1)"; fi
  done
}
[ -n "$inplace" ] || snap > $TMP/before
touched=$TMP/touched
: > $touched
# files PATTERN: regular files on the image's own filesystem whose path
# matches find's -path PATTERN, outside the kernel's and these scripts'
# directories, one per line.
files() {
  $bb find / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path '/.limani-*' \) -prune -o -path "$1" -type f -print 2>/dev/null
}

mode=none
if [ -d /usr/share/ca-certificates ] && have update-ca-certificates; then
  # Debian, Ubuntu, Kali; Alpine with ca-certificates.
  mode=distro
  for c in $CA/*.crt; do
    n=$($bb basename "$c")
    if [ -f "/usr/share/ca-certificates/mozilla/$n" ]; then
      $bb cp "$c" "/usr/share/ca-certificates/mozilla/$n"
    else
      $bb mkdir -p /usr/local/share/ca-certificates
      $bb cp "$c" "/usr/local/share/ca-certificates/$n"
    fi
  done
  if ! update-ca-certificates >/dev/null 2>$TMP/update; then
    echo "update-ca-certificates failed: $($bb tail -n 3 $TMP/update 2>/dev/null)" >&2
  fi
elif have update-ca-trust && [ -d /etc/pki/ca-trust/source/anchors ]; then
  # RHEL, Fedora, UBI, Amazon Linux, Rocky. The real root of the same name
  # stays in the read-only distribution bundle, so it is blocklisted
  # (best effort: needs p11-kit's trust tool) and the simulated one added.
  mode=rhel
  for c in $CA/*.crt; do
    n=$($bb basename "$c" .crt)
    name=$(label "$n.crt")
    if [ -n "$name" ] && have trust; then
      trust list --filter=ca-anchors 2>/dev/null | $bb awk -v name="$name" '
        /^pkcs11:/ { uri = $0 }
        $1 == "label:" { sub(/^[ \t]*label: /, ""); if ($0 == name) print uri }' > $TMP/uris || true
      i=0
      while read -r uri; do
        i=$((i + 1))
        trust extract --overwrite --format=pem-bundle --filter="$uri" "/etc/pki/ca-trust/source/blocklist/$n-$i.pem" 2>/dev/null || true
      done < $TMP/uris
    fi
    $bb cp "$c" /etc/pki/ca-trust/source/anchors/
  done
  update-ca-trust extract || echo "update-ca-trust failed" >&2
else
  # Images with only a bundle: Alpine's ca-certificates-bundle, distroless.
  for b in /etc/ssl/certs/ca-certificates.crt /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/ca-bundle.pem /etc/ssl/cert.pem; do
    [ -e "$b" ] || continue
    r=$($bb readlink -f "$b")
    [ -f "$r" ] || continue
    $bb grep -qxF "$r" $touched && continue
    mode=bundle
    for c in $CA/*.crt; do $bb cat "$c" >> "$r"; done
    echo "$r" >> $touched
  done
fi

# The store's bundle, which TLS clients read, must now hold every root. A
# failed update (a full disk, say) leaves the bundle it had: with the real
# root of a replaced name and without the simulated one, so the agent CLI
# fails every connection to the model API (rustls: BadSignature; Node and
# Bun: UNABLE_TO_GET_ISSUER_CERT_LOCALLY). The player's build fails then,
# rather than leave a cached image that can never reach the model API; a
# service's build goes on, as before, with the reason in its log.
case $mode in
distro) store=/etc/ssl/certs/ca-certificates.crt ;;
rhel) store=/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem ;;
*) store= ;;
esac
if [ -n "$store" ]; then
  missing=
  for c in $CA/*.crt; do
    body=$($bb sed '/^-----/d' "$c" | $bb tr -d '\r\n')
    if [ ! -r "$store" ] || ! $bb tr -d '\r\n' < "$store" | $bb grep -qF "$body"; then
      missing="$missing $($bb basename "$c")"
    fi
  done
  if [ -n "$missing" ]; then
    echo "the simulated roots$missing are not in $store" >&2
    [ -z "$inplace" ] || exit 1
  fi
fi

# Node and Bun read NODE_EXTRA_CA_CERTS, and Deno the system store, which
# the final stage points at /etc/ssl/certs/ca-certificates.crt. Where a
# JavaScript runtime is installed but that file doesn't exist (an image
# without a store, such as node:*-slim; RHEL, whose bundle has another
# name), it is created: a link to the system bundle when there is one,
# else the task's roots alone. Node then verifies real sites with its
# compiled-in roots and simulated ones with these, and prints no warning
# about a missing file. Without a JavaScript runtime the variable is read
# by nothing, and nothing is added.
js=
for r in node nodejs bun deno; do have "$r" && js=1; done
[ -n "$js" ] || [ -z "$(files '*/bin/node'; files '*/bin/bun'; files '*/bin/deno')" ] || js=1
extra=/etc/ssl/certs/ca-certificates.crt
if [ -n "$js" ] && [ ! -e "$extra" ]; then
  $bb mkdir -p /etc/ssl/certs
  for b in /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/ca-bundle.pem /etc/ssl/cert.pem; do
    if [ -f "$b" ]; then $bb ln -s "$b" "$extra"; break; fi
  done
  if [ ! -e "$extra" ]; then
    for c in $CA/*.crt; do $bb cat "$c"; done > "$extra"
    $bb chmod 644 "$extra"
  fi
  # The snapshots of /etc/ssl and /etc/pki pick it up, at its real path
  # (on RHEL /etc/ssl/certs is a link).
fi

# Python's certifi copies (requests, httpx, pip's vendored copy), in any
# virtualenv: the real root's block goes, the simulated one is appended in
# certifi's own format. Debian's python3-certifi already points at the
# system bundle and is a link, not a regular file.
files '*/certifi/cacert.pem' > $TMP/certifi-files
while read -r f; do
  for c in $CA/*.crt; do
    name=$(label "$($bb basename "$c")")
    $bb awk -v name="$name" '
      /^# Issuer: / && !inblock { inblock = 1; block = ""; drop = 0 }
      inblock { block = block $0 "\n"; if ($0 == "# Label: \"" name "\"") drop = 1
        if ($0 == "-----END CERTIFICATE-----") { inblock = 0; if (!drop) printf "%s", block }
        next }
      { print }' "$f" > $TMP/certifi
    { printf '\n# Issuer: CN=%s\n# Subject: CN=%s\n# Label: "%s"\n' "$name" "$name" "$name"; $bb cat "$c"; } >> $TMP/certifi
    $bb cat $TMP/certifi > "$f"
  done
  echo "$f" >> $touched
done < $TMP/certifi-files

# Java runtimes with their own cacerts (Temurin, OpenJDK images). Debian's
# and RHEL's link theirs to the system store, which their tools rebuilt
# above. Best effort: keytool must work in the image.
files '*/lib/security/cacerts' > $TMP/java-files
while read -r f; do
  keytool=${f%/lib/security/cacerts}/bin/keytool
  [ -x "$keytool" ] || keytool=$(command -v keytool 2>/dev/null) || continue
  for c in $CA/*.crt; do
    alias=$($bb basename "$c" .crt | $bb tr 'A-Z' 'a-z')
    "$keytool" -delete -noprompt -keystore "$f" -storepass changeit -alias "$alias" >/dev/null 2>&1 || true
    "$keytool" -importcert -noprompt -keystore "$f" -storepass changeit -alias "$alias" -file "$c" >/dev/null 2>&1 \
      && echo "$f" >> $touched || echo "keytool could not import into $f" >&2
  done
done < $TMP/java-files

if [ -n "$inplace" ]; then
  $bb rm -rf $TMP
  exit 0
fi
snap > $TMP/after
{ $bb comm -13 $TMP/before $TMP/after | $bb sed 's/ [LF] .*$//'; $bb cat $touched; } | $bb sort -u > $TMP/changed
$bb mkdir -p $OUT
if [ -s $TMP/changed ]; then
  $bb tar -cf - -T $TMP/changed 2>/dev/null | $bb tar -xf - -C $OUT
fi
echo "trust roots: $mode, $($bb wc -l < $TMP/changed) files" >&2
$bb rm -rf $TMP
