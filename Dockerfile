FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY requirements.txt ./
RUN python3 -m venv .venv \
  && .venv/bin/pip install --upgrade pip \
  && .venv/bin/pip install -r requirements.txt

COPY . .

ENV NODE_ENV=production
ENV PATH="/app/.venv/bin:${PATH}"

EXPOSE 3000

CMD ["npm", "start"]
