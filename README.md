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
    npx ncu
    npx ncu -u
    npm install
    npm rebuild
    npx browserslist@latest --update-db
