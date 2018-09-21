#! /usr/bin/python3
# -*- coding: utf-8 -*-

import requests
import logging as log

from sys import exit

from config import request_url


s = requests.Session()
s.trust_env = False

try:
    r = s.get(request_url('hi'), timeout=3)
    if r.status_code == 200:
        exit(0)
except requests.ConnectTimeout:
    log.warning('建立到目标的TCP链接超时，无法链接到服务器：PyWiki服务器没有运行')
    exit(1)
except requests.ConnectionError:
    log.warning('[WinError 10061] 由于目标计算机积极拒绝，无法连接：PyWiki服务器没有运行')
    exit(1)
except requests.ReadTimeout:
    log.error('读超时，服务器可接收，App服务器无响应')
    exit(2)
except requests.HTTPError:
    log.error('HTTP错误，服务器可接收，但是WSGI服务器无响应')
    exit(2)
except requests.TooManyRedirects:
    log.critical('环境/网络问题')
    exit(3)
else:
    log.debug('未知异常，服务器没有启动')
    exit(5)
