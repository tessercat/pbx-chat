# Run this as root from /opt/pbx.
FROM_CSS=/opt/pbx/ui/dist/css
FROM_JS=/opt/pbx/ui/dist/js
NGINX=/opt/pbx/static
PROJECT=/opt/pbx/web

NGINX_COMMON_CSS=$NGINX/common/css
mkdir -p $NGINX_COMMON_CSS
rm $NGINX_COMMON_CSS/*
cp $FROM_CSS/common* $NGINX_COMMON_CSS

NGINX_CONFERENCE_CSS=$NGINX/conference/css
mkdir -p $NGINX_CONFERENCE_CSS
rm $NGINX_CONFERENCE_CSS/*
cp $FROM_CSS/conference* $NGINX_CONFERENCE_CSS

NGINX_CONFERENCE_JS=$NGINX/conference/js
mkdir -p $NGINX_CONFERENCE_JS
rm $NGINX_CONFERENCE_JS/*
cp $FROM_JS/* $NGINX_CONFERENCE_JS

chown -R www-data:www-data $NGINX/common
chown -R www-data:www-data $NGINX/conference

APP_COMMON_CSS=$PROJECT/common/static/common/css
mkdir -p $APP_COMMON_CSS
rm $APP_COMMON_CSS/*
cp $FROM_CSS/common* $APP_COMMON_CSS

APP_CONFERENCE_CSS=$PROJECT/conference/static/conference/css
mkdir -p $APP_CONFERENCE_CSS
rm $APP_CONFERENCE_CSS/*
cp $FROM_CSS/conference* $APP_CONFERENCE_CSS

APP_CONFERENCE_JS=$PROJECT/conference/static/conference/js
mkdir -p $APP_CONFERENCE_JS
rm $APP_CONFERENCE_JS/*
cp $FROM_JS/* $APP_CONFERENCE_JS

chown -R pbx-web:pbx-web $PROJECT/common/static
chown -R pbx-web:pbx-web $PROJECT/conference/static

PROJECT_COMMON_CSS=$PROJECT/static/common/css
mkdir -p $PROJECT_COMMON_CSS
rm $PROJECT_COMMON_CSS/*
cp $FROM_CSS/common* $PROJECT_COMMON_CSS

PROJECT_CONFERENCE_CSS=$PROJECT/static/conference/css
mkdir -p $PROJECT_CONFERENCE_CSS
rm $PROJECT_CONFERENCE_CSS/*
cp $FROM_CSS/conference* $PROJECT_CONFERENCE_CSS

PROJECT_CONFERENCE_JS=$PROJECT/static/conference/js
mkdir -p $PROJECT_CONFERENCE_JS
rm $PROJECT_CONFERENCE_JS/*
cp $FROM_JS/* $PROJECT_CONFERENCE_JS

chown -R pbx-web:pbx-web $PROJECT/static/common
chown -R pbx-web:pbx-web $PROJECT/static/conference
