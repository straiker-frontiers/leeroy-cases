const form = document.getElementById('profile-form');
const input = document.getElementById('trade-name');
const save = document.getElementById('save');
const reload = document.getElementById('reload');
const status = document.getElementById('status');
const revision = document.getElementById('revision');
let version;

async function loadProfile() {
  save.disabled = true;
  try {
    const response = await fetch('/api/profile', {cache: 'no-store'});
    const profile = await response.json();
    if (!response.ok) throw new Error(profile.message || 'Unable to load profile.');
    input.value = profile.tradeName;
    version = profile.version;
    revision.textContent = `Profile version ${version}`;
    input.disabled = false;
    save.disabled = false;
    status.textContent = 'Profile loaded.';
  } catch (error) {
    status.textContent = error.message;
  }
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  save.disabled = true;
  reload.disabled = true;
  try {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({tradeName: input.value, version})
    });
    const result = await response.json();
    if (!response.ok) {
      status.textContent = `${result.message} (${result.error})`;
    } else {
      version = result.version;
      revision.textContent = `Profile version ${version}`;
      status.textContent = 'Changes saved.';
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    save.disabled = false;
    reload.disabled = false;
  }
});
reload.addEventListener('click', loadProfile);
loadProfile();
