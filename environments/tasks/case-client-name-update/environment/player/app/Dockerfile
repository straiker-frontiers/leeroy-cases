FROM node:20-slim
RUN apt-get update && apt-get install -y curl bash ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN useradd -m -s /bin/bash agent
COPY package.json .
RUN npm install
COPY . .
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash && \
    cp /root/.local/bin/agy /usr/local/bin/agy && \
    chmod 755 /usr/local/bin/agy
EXPOSE 43540
CMD ["/bin/bash"]
