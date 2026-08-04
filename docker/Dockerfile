FROM php:8.2-apache

# MySQL driver + URL rewriting for the /api front controller.
RUN docker-php-ext-install pdo_mysql && a2enmod rewrite

# Allow the api/.htaccess to take effect (default image is AllowOverride None).
RUN printf '<Directory /var/www/html>\n    AllowOverride All\n    Require all granted\n</Directory>\n' \
      > /etc/apache2/conf-available/override.conf \
    && a2enconf override

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# api/ is bind-mounted by docker-compose in dev (live editing). On Hostinger the
# same api/ folder is deployed as plain PHP — no image involved.
ENTRYPOINT ["entrypoint.sh"]
CMD ["apache2-foreground"]
