""" Deploy UI artifacts to nginx and project static dirs. """
import os
from shutil import copy2
from pwd import getpwnam

PBX = '/opt/pbx'

# From these directories.
DIST = os.path.join(PBX, 'ui', 'dist')
COMMON_CSS = os.path.join(DIST, 'css', 'common')
CLIENT_CSS = os.path.join(DIST, 'css', 'client')
CLIENT_JS = os.path.join(DIST, 'js')

# To these directories.
APP = 'intercom'
STATIC = os.path.join(PBX, 'static')
PROJECT = os.path.join(PBX, 'web')
APP_COMMON = os.path.join(PROJECT, 'common', 'static', 'common')
APP_CHANNEL = os.path.join(PROJECT, APP, 'static', APP)
PROJECT_COMMON = os.path.join(PROJECT, 'static', 'common')
PROJECT_CHANNEL = os.path.join(PROJECT, 'static', APP)


def clear(dst):
    """ Remove all files in a directory. """
    for filename in os.listdir(dst):
        path = os.path.join(dst, filename)
        os.remove(path)
        print('Cleared %s' % path)


def copy(src, dst, owner):
    """ Copy a file and chmod it. """
    copy2(src, dst)
    pwd_data = getpwnam(owner)
    os.chown(dst, pwd_data.pw_uid, pwd_data.pw_gid)
    print('Copied %s' % dst)


def common_css():
    """ Clear and copy common css dist files. """
    app_css = os.path.join(APP_COMMON, 'css')
    project_css = os.path.join(PROJECT_COMMON, 'css')
    static_css = os.path.join(STATIC, 'common', 'css')
    clear(app_css)
    clear(project_css)
    clear(static_css)
    for filename in os.listdir(COMMON_CSS):
        if filename.startswith('common'):
            src = os.path.join(COMMON_CSS, filename)
            dst = os.path.join(app_css, filename)
            copy(src, dst, 'pbx-web')
            dst = os.path.join(project_css, filename)
            copy(src, dst, 'pbx-web')
            dst = os.path.join(static_css, filename)
            copy(src, dst, 'www-data')


def client_css():
    """ Clear and copy client css dist files. """
    app_css = os.path.join(APP_CHANNEL, 'css')
    project_css = os.path.join(PROJECT_CHANNEL, 'css')
    static_css = os.path.join(STATIC, APP, 'css')
    clear(app_css)
    clear(project_css)
    clear(static_css)
    for filename in os.listdir(CLIENT_CSS):
        if filename.startswith('client'):
            src = os.path.join(CLIENT_CSS, filename)
            dst = os.path.join(app_css, filename)
            copy(src, dst, 'pbx-web')
            dst = os.path.join(project_css, filename)
            copy(src, dst, 'pbx-web')
            dst = os.path.join(static_css, filename)
            copy(src, dst, 'www-data')


def client_js():
    """ Clear and copy client js dist files. """
    app_js = os.path.join(APP_CHANNEL, 'js')
    project_js = os.path.join(PROJECT_CHANNEL, 'js')
    static_js = os.path.join(STATIC, APP, 'js')
    clear(app_js)
    clear(project_js)
    clear(static_js)
    for filename in os.listdir(CLIENT_JS):
        src = os.path.join(CLIENT_JS, filename)
        dst = os.path.join(app_js, filename)
        copy(src, dst, 'pbx-web')
        dst = os.path.join(project_js, filename)
        copy(src, dst, 'pbx-web')
        dst = os.path.join(static_js, filename)
        copy(src, dst, 'www-data')


def main():
    """ Clear and copy dist files. """
    common_css()
    client_css()
    client_js()


if __name__ == '__main__':
    main()
