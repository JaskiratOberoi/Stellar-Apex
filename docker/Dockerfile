FROM php:8.2-apache

# MySQL driver + URL rewriting for the /api front controller.
RUN docker-php-ext-install pdo_mysql && a2enmod rewrite

# Onboarding photo uploads (Aadhaar/PAN, both sides = 4 files) need more than
# the 2M/8M defaults.
RUN printf 'upload_max_filesize=10M\npost_max_size=45M\n' \
      > /usr/local/etc/php/conf.d/uploads.ini \
    && mkdir -p /var/uploads && chown www-data:www-data /var/uploads

# Allow the api/.htaccess to take effect (default image is AllowOverride None).
RUN printf '<Directory /var/www/html>\n    AllowOverride All\n    Require all granted\n</Directory>\n' \
      > /etc/apache2/conf-available/override.conf \
    && a2enconf override

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# Strip Windows line endings (a CRLF shebang breaks exec) and make executable.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

# api/ is bind-mounted by docker-compose in dev (live editing). On Hostinger the
# same api/ folder is deployed as plain PHP — no image involved.
ENTRYPOINT ["entrypoint.sh"]
CMD ["apache2-foreground"]
