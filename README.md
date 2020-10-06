This node package
is a FreeSWITCH verto endpoint
WebSocket client
to support the features of the project
documented at
[pbx-docs](https://github.com/tessercat/pbx-docs).

# Dev

Requires root on the dev host
to change the `pbx-web` user's shell,
to clone the repo to `/opt/pbx`
and to run the deploy commands.

[Install nvm](https://github.com/nvm-sh/nvm#install--update-script)
for the `pbx-web` shell account.

Check the lastest version and:

    cd ~
    wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/<version>/install.sh > nvm.sh
    bash nvm.sh

Start a new terminal and:

    nvm install node
    cd /opt/pbx/client
    npm install
    git checkout dev
    npm run-script build
