---
author: stackbug
pubDatetime: 2025-06-12T00:00:00+08:00
title: 解决 Vue Router History 模式刷新 404 问题的 Nginx 配置
slug: vue-router-history-mode-nginx-404-fix
featured: false
draft: false
tags:
  - vue
  - frontend
  - nginx
description: Vue Router history 模式刷新出 404 的根因，以及对应的 Nginx try_files 配置示例。
---

# 解决Vue Router History模式刷新404问题的Nginx配置

## 问题背景

在使用 Vue.js 开发单页面应用 (SPA) 时，如果 Vue Router 采用 `history` 模式，会遇到一个常见问题：当用户在浏览器中直接访问或刷新非首页路由时，会出现 404 错误。

这是因为 Vue Router 的 `history` 模式会产生类似 `/about`、`/user/123` 这样的 URL，当用户刷新页面时，浏览器会向服务器请求这些路径对应的文件，但服务器上实际并不存在这些文件，因此返回 404 错误。

## 解决方案

解决这个问题的思路是：让服务器将所有前端路由请求都指向 Vue 应用的入口文件 `index.html`，然后由 Vue Router 接管路由处理。

### Nginx 配置修改

在 Nginx 配置中添加以下关键配置：

```nginx
# Vue Router History 模式支持 - 核心配置
location / {
    try_files $uri $uri/ /index.html;
}
```

这行配置的工作原理：

1. 首先尝试访问请求的文件 `$uri`
2. 如果文件不存在，尝试访问对应目录 `$uri/`
3. 如果目录也不存在，最后返回 `index.html`

### 完整配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/your/vue/dist;
    index index.html;

    # Vue Router 支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源优化
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API 接口路由（如果有后端 API）
    location /api {
        try_files $uri $uri/ @fallback;
    }
}
```

### 注意事项

注释掉原有的 404 配置：

```nginx
# 注释掉这行，避免与 Vue 路由冲突
# error_page 404 /404.html;
```

1. API 路由分离：如果项目有后端 API，需要单独配置 API 路由，确保 API 请求不会被重定向到 index.html。
2. 静态资源处理：对于 CSS、JS、图片等静态资源，应该直接返回 404 而不是 index.html，避免资源加载错误。

## Vue Router 配置确认

确保 Vue 应用中使用的是 history 模式：

```js
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(), // 使用 history 模式
  routes: [
    // 你的路由配置
  ]
})
```

## 部署步骤

1. 修改 Nginx 配置文件
2. 测试配置语法：`nginx -t`
3. 重新加载配置：`nginx -s reload`
4. 测试各个路由的刷新功能

## 原理总结

本质是利用了 SPA 的工作特点：

- 服务器只需要提供静态的 HTML、CSS、JS 文件
- 所有路由实际上都是由前端 JavaScript 控制的
- 通过 `try_files` 指令，将所有不存在的路径请求都指向入口文件
- 前端应用加载后，Vue Router 会根据当前 URL 显示对应的组件

这样就解决了 Vue Router history 模式下的刷新 404 问题。
