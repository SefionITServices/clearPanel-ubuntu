# ==============================================================================
# ClearMail Standalone Webmail Dockerfile
# Production Nginx Server running on Port 7510
# ==============================================================================

FROM nginx:1.27-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy pre-compiled Flutter Web bundle
COPY build/web /usr/share/nginx/html

# Copy Nginx configuration template and entrypoint
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose Standalone Port 7510
EXPOSE 7510

# Default environment pointing to ClearPanel backend on port 3334
ENV CLEARPANEL_URL=http://host.docker.internal:3334

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

