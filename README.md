This NPM package
is a FreeSWITCH verto endpoint
WebSocket client
to support the features of the project
documented at
[pbx-docs](https://github.com/tessercat/pbx-docs).

# Dev

## nvm

[Install nvm](https://github.com/nvm-sh/nvm#install--update-script)
into the `pbx-web` shell account.

Check the lastest version and:

    cd ~
    wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/<version>/install.sh > nvm.sh
    bash nvm.sh

Start a new terminal and:

    nvm install node
    cd /opt/pbx/ui
    npm install
    git checkout dev
    npm run build

## Update

    nvm install-latest-npm
    npm update
    npm rebuild
    npx browserslist@latest --update-db

## Reset

    mv package.json package.json.old
    mv package-lock.json package-lock.json.old
    npm init

    npm install --save-dev eslint
    npm install --save-dev webpack webpack-cli clean-webpack-plugin compression-webpack-plugin
    npm install --save-dev node-sass postcss postcss-cli postcss-hash autoprefixer
    npm install --save-dev rimraf gzip-cli

    npm install --save-dev copy-webpack-plugin
    npm install --save-dev webrtc-adapter

    npm update
    npm run build
