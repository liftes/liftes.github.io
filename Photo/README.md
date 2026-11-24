# Photo 摄影子站

独立入口：Photo/index.html。首页和三类图库仅加载 Photo/css/photo.css、Photo/js/photo.js 和 Photo/data/photos.js，不依赖学术主站样式或旧模板组件。

## 增删照片

- 首页精选：img-Norfe/Recent/
- 单人：SubSites/single/
- 双人：SubSites/double/
- 团体：SubSites/more/

增删图片后，在网站根目录执行：

```
node Photo/scripts/update-photos.cjs
```

脚本递归扫描以上四个目录，按文件名自然排序，生成 Photo/data/photos.js。支持 jpg、jpeg、png、webp、avif、gif。不会改动任何原图。将图片与更新后的清单一起提交、推送。

当前不修改根目录的 GitHub Actions 工作流，因此发布时不会自动运行扫描；必须先更新清单。未来若允许改部署配置，可在上传静态站点前运行同一脚本。

首页封面与正文同宽，宽屏文字块从右侧叠入图片，820px 以下上图下文。photo.css 的 --cover-image-end / --cover-copy-start 控制图片和文字块的网格范围。介绍与社交链接已前置，不显示浏览作品链接。

首页精选分风景、人像、花鸟三个独立胶片列表。data/albums.json 的 images 引用现有照片，不移动原图；folder 指定额外扫描目录：

- 风景：img-Norfe/Collections/landscape/
- 人像：img-Norfe/Collections/portrait/
- 花鸟：img-Norfe/Collections/nature/

这些目录可按需创建，放入照片后运行同一更新脚本即可自动收录。显式列表在前，目录新增图片按文件名自然排序并去重。修改分类只需调整 albums.json，再更新清单；图片内容不会被自动识别分类。

## 样式与交互

photo.css 的 :root 集中管理配色。三个胶片窗口独立运行，高度由 .filmstrip 的 --film-height 控制，每 5 秒前进一张并循环；当前窗口容得下全部照片时不滚动。悬停、焦点进入、窗口不可见或大图打开时暂停；手动滑动或点击方向按钮后暂停，需点击播放恢复。减少动态效果开启时不自动播放。照片下不显示序号或完整查看链接。毕业照图库仍为宽屏三列、中屏两列、600px 以下单列，使用同一大图查看器。

点击胶片中的任意照片，从该张进入完整列表。大图支持关闭、前后切换、方向键、Escape 和单指横向滑动；不支持 dialog 的浏览器直接打开图片。首屏封面优先加载，图库延迟加载。旧模板资产保留但不再加载。

静态审查不等于浏览器视觉验证。
