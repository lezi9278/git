import test from "node:test";
import assert from "node:assert/strict";
import {
  plainTextToRichHtml,
  sanitizeRichText,
  stripHtml,
} from "../src/core/richtext.js";

test("sanitizeRichText 移除脚本块、事件属性与不受支持的标签", () => {
  assert.equal(sanitizeRichText('<script>alert(1)</script>正文'), "正文");
  assert.equal(sanitizeRichText("<style>.x{}</style>内容"), "内容");
  assert.equal(sanitizeRichText('<p onclick="alert(1)">你好</p>'), "<p>你好</p>");
  assert.equal(sanitizeRichText("<div><h1>标题</h1>正文</div>"), "<div>标题正文</div>");
  assert.equal(sanitizeRichText("<img src=x onerror=alert(1)>"), "");
  assert.equal(sanitizeRichText(42), "");
});

test("sanitizeRichText 只保留白名单样式属性并拦截危险值", () => {
  assert.equal(
    sanitizeRichText('<span style="color: red; position: fixed">字</span>'),
    '<span style="color: red">字</span>',
  );
  assert.equal(
    sanitizeRichText('<span style="background: url(x.png)">字</span>'),
    "<span>字</span>",
  );
  assert.equal(
    sanitizeRichText('<span style="font-size: 20px">字</span>'),
    '<span style="font-size: 20px">字</span>',
  );
  assert.equal(sanitizeRichText('<font size="7" color="red">旧</font>'), "<font>旧</font>");
});

test("plainTextToRichHtml 转义 HTML 并把换行转换为 br", () => {
  assert.equal(plainTextToRichHtml("第一行\n第二行<b>"), "第一行<br>第二行&lt;b&gt;");
  assert.equal(plainTextToRichHtml(""), "");
});

test("stripHtml 提取纯文本并还原实体", () => {
  assert.equal(
    stripHtml('<div style="color: red">你好<u>世界</u></div><p>第二段</p>'),
    "你好世界\n第二段",
  );
  assert.equal(stripHtml("第一行<br>第二行"), "第一行\n第二行");
  assert.equal(stripHtml("<p>A &amp; B</p>"), "A & B");
  assert.equal(stripHtml("<div><br></div>"), "");
  assert.equal(stripHtml(undefined), "");
});
