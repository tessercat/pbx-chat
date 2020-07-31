APP=channels
FROM=/opt/pbx/client/dist
NGINX_STATIC=/opt/pbx/static/$APP/js
APP_STATIC=/opt/pbx/web/$APP/static/$APP/js
PROJECT_STATIC=/opt/pbx/web/static/$APP/js
rm $NGINX_STATIC/client-*
rm $NGINX_STATIC/adapter-*
cp $FROM/* $NGINX_STATIC
chown nginx:nginx $NGINX_STATIC/*

rm $APP_STATIC/client-*
rm $APP_STATIC/adapter-*
cp $FROM/* $APP_STATIC
chown pbx-web:pbx-web $APP_STATIC/*

rm $PROJECT_STATIC/client-*
rm $PROJECT_STATIC/adapter-*
cp $FROM/* $PROJECT_STATIC
chown pbx-web:pbx-web $PROJECT_STATIC/*
