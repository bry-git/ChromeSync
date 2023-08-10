FROM node:latest
ARG API_KEY
ARG HOSTNAME
# Copy source code to container
COPY chrome-sync-client /opt/chrome-sync-client
COPY chrome-sync-service /opt/chrome-sync-service
# Get dependencies from apt
RUN apt update -y
RUN apt install systemctl -y
RUN apt install openssl -y
# Generate SSL private key and public key
# no prompt, 10 year expiry, not signed by CSR
RUN openssl req -x509 -newkey rsa:4096 \
    -keyout /etc/ssl/private/nginx.key \
    -out /etc/ssl/certs/nginx.crt \
    -sha256 -days 3650 -nodes \
    -subj "/C=XX/ST=StateName/L=CityName/O=CompanyName/OU=CompanySectionName/CN=CommonNameOrHostname"
# Install and configure Nginx
RUN apt install nginx -y
RUN mkdir -p /etc/nginx/snippits/
# Generate self signed certificate config
# https://www.howtogeek.com/devops/how-to-create-and-use-self-signed-ssl-on-nginx/
RUN echo " \
      ssl_certificate /etc/ssl/certs/nginx.crt; \n\
      ssl_certificate_key /etc/ssl/private/nginx.key; \n\
      ssl_protocols TLSv1.2; \n\
      ssl_prefer_server_ciphers on; \n\
      ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384; \n\
      ssl_session_timeout 10m; \n\
      ssl_session_cache shared:SSL:10m; \n\
      ssl_session_tickets off; \n\
      ssl_stapling on; \n\
      ssl_stapling_verify on; \n\
      resolver 1.1.1.1 1.0.0.1 valid=300s; \n\
      resolver_timeout 5s; \n\
      add_header X-Frame-Options DENY; \n\
      add_header X-Content-Type-Options nosniff; \n\
      add_header X-XSS-Protection \"1; \ mode=block\";" > /etc/nginx/snippets/self-signed.conf
# Generate nginx SSL config
# the service is configured to listen on 3030 and the system is intended
# to map host:443 -> container nginx:443 -> container node:3030
RUN echo " \
events {}\n\
http { \n\
      server { \n\
          listen 443 ssl; \n\
          listen [::]:443 ssl; \n\
          default_type application/json; \n\
          include snippets/self-signed.conf; \n\
          server_name example.com www.example.com; \n\
          location / { \n\
            proxy_pass  http://127.0.0.1:3030/; \n\
        } \n\
  } \n\
}" > /etc/nginx/nginx.conf
# Enable Nginx in systemd
RUN systemctl enable nginx
# Set workdir for client
RUN cd /opt/chrome-sync-client
WORKDIR /opt/chrome-sync-client
# Get node dependencies from npm
RUN npm install
# Make API_KEY available to client
RUN echo "REACT_APP_API_KEY=$API_KEY \n REACT_APP_ENDPOINT=$HOSTNAME" > .env
# client artifact will be at container:/opt/chrome-sync-client/build
RUN npm run build:dev
# Set Workdir for service
RUN cd /opt/chrome-sync-service
WORKDIR /opt/chrome-sync-service
# Get node dependencies from npm
RUN npm install
# Build service with webpack
RUN npm run build
# Expose port, is No-op but used for image metadata
EXPOSE 3030
RUN echo "systemctl start nginx && API_KEY=$API_KEY node build/ChromeSyncService.js" > /opt/chrome-sync-service/entrypoint.sh
RUN chmod +x /opt/chrome-sync-service/entrypoint.sh
# Entrypoint
CMD ["./entrypoint.sh"]



