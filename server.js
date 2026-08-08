/*
 * 排队大屏 · 局域网服务（纯 Node 内置模块，云部署时需 pg）
 * 含扫码取号（C 前缀）+ 等待时长预估 + 局域网 IP 查询
 * 支持动态多机台 + 会员累计次数 + 会员名称叫号
 * 支持本地文件存储 + PostgreSQL 云部署（Render 等 PaaS）
 */
"use strict";
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const PORT = process.env.PORT || 8787;
const STATE_FILE = path.join(__dirname, "state.json");
var SCAN_PREFIX = "C";
var VIP_THRESHOLD = 10;
// ===== PostgreSQL 连接（有 DATABASE_URL 时启用云存储，否则用本地文件）=====
let pgPool = null;
try { const { Pool } = require("pg"); if (process.env.DATABASE_URL) pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 }); } catch (e) {}
// ===== AI 内容审核配置（从环境变量读取，兼容本地硬编码）=====
const AI_MOD = {
  enabled: !!(process.env.AI_MOD_URL),
  url: process.env.AI_MOD_URL || "",
  key: process.env.AI_MOD_KEY || "",
  model: process.env.AI_MOD_MODEL || "",
  timeout: 30000
};

function defaultState() {
  return {
    shopName: "你的店名 LOGO",
    tagline: "欢迎光临 · 排队中请留意大屏叫号",
    machines: [
      { id: "maimai", label: "舞萌", status: "ok" },
      { id: "chunithm", label: "中二节奏", status: "ok" }
    ],
    machineLabels: { maimai: "舞萌", chunithm: "中二节奏" },
    machineStatus: { maimai: "ok", chunithm: "ok" },
    prices: [
      { item: "舞萌 单曲", amount: "¥10" },
      { item: "中二节奏 单曲", amount: "¥10" },
      { item: "畅玩 1 小时", amount: "¥30" },
      { item: "会员卡", amount: "¥5" }
    ],
    scanCounter: { maimai: 0, chunithm: 0 },
    queues: { maimai: [], chunithm: [] },
    enqueuedAt: { maimai: {}, chunithm: {} },
    current: { maimai: null, chunithm: null },
    waitHistory: { maimai: [], chunithm: [] },
    membership: { log: [] },
    members: [],
    numberMeta: { maimai: {}, chunithm: {} },
    avatars: {},
    calledHistory: [],
    bgImage: null,
    bgBrightness: 60,
    consolePassword: "123456",
    autoCall: { enabled: false, duration: 8 },
    callTime: {},
    closingTime: "",
    posts: [],
    announcements: [],
    blockedWords: [
      "我操你妈","操你妈","我操","操了","操死","日你妈","日你","干你妈","干你","干死你",
      "我丢你老母","丢你老母","丢你妈","丢你","扑街","仆街",
      "想操死你","操死你","操你","草你妈","草泥马","草你","草了",
      "傻逼","煞笔","啥比","沙雕","傻B","sha bi","shabi","s b","sb","2b","2B",
      "牛逼"," NB "," nb ",
      "妈的","他妈的","他妈","你妈的","你妈","你大爷","你奶奶的",
      "狗日","狗操","狗娘","狗东西","狗男女",
      "王八蛋","王八","乌龟王八",
      "婊子","婊","表子","贱人","贱货","贱逼","小贱人",
      "滚蛋","滚你妈","滚开",
      "废物","废柴","废人",
      "去死","去死吧","你怎么不去死","去死好了",
      "fuck","fuk","f u c k","FUck","FUCK","Fuk",
      "shit","SHIT","Shit",
      "bitch","BITCH","Bitch",
      "asshole","ASSHOLE","Asshole",
      "dick","DIICK","Dick",
      "pussy","PUSSY","Pussy",
      "damn","DAMN","Damn",
      "杂种","杂碎","畜生","畜牲","牲口",
      "强奸","强暴","轮奸","猥亵",
      "鸡巴","鸡鸡","鸡儿","鸡你太美","丁丁","弟弟","小弟弟",
      "奶子","咪咪","胸器","罩杯",
      "屁股","菊花","后庭",
      "性交","做爱","上床","开房","约炮","约吗","包夜","包夜吗",
      "黄片","AV","av","小电影","看片","毛片","色情","黄色","h片","H片",
      "毒品","大麻","冰毒","摇头丸","可卡因","海洛因","K粉","吸毒","贩毒",
      "赌博","赌钱","赌场","下注","押注","外围赌球",
      "死全家","全家死光","死光全家","绝子绝孙","断子绝孙",
      "脑子有病","神经病","精神病","脑残","脑瘫","弱智","白痴","智障",
      "滚出","滚出去","滚回来",
      "垃圾","圾垃","人渣","渣渣","败类",
      "我日","我靠","我擦","我去","我倒","我晕",
      "尼玛","泥煤","尼美",
      "艹","cao","CAO","Cao","艹蛋","艹了","草了","艹你",
      "妈逼","MB","mb","你mb","你MB",
      "装逼","装B","装b","装13","装十三",
      "撕逼","撕B","撕b",
      "苦逼","苦B","苦b",
      "二逼","二B","二b",
      "臭傻逼","臭煞笔","大傻逼","大煞笔",
      "臭婊子","骚货","骚逼","骚B","骚b","骚里骚气",
      "臭不要脸","不要脸","无耻","厚颜无耻",
      "下贱","下流","淫荡","淫秽","猥琐",
      "娘炮","太监","人妖","二椅子",
      "娘们","娘们儿","娘娘腔",
      "老子","老娘","姑奶奶","大爷我",
      "杀你","杀了你","弄死你","打死你","揍死你",
      "找死","找抽","找打","欠揍","欠扁","欠干",
      "有病","脑子进水","脑壳坏掉","脑子坏掉",
      "丑八怪","丑逼","丑死","丑陋","丑鬼",
      "胖子","肥猪","肥逼","死胖子",
      "矮子","矮冬瓜","矮逼","矬子",
      "瞎子","聋子","哑巴","瘸子","残废",
      "老子揍你","揍你","打你","砍你",
      "你算什么","算什么东西","什么东西","不是东西",
      "去你的","滚你的","你的妈","你妈的",
      "老子有钱","有钱了不起","有钱就了不起",
      "穷鬼","穷逼","穷酸","穷酸样",
      "乡下人","土包子","土老帽","土鳖","泥腿子",
      "装蒜","装模作样","装腔作势","装嫩",
      "假正经","假惺惺","假慈悲",
      "虚情假意","虚伪装","虚伪",
      "恶心","恶心的","恶心死","恶心到",
      "滚粗","滚蛋","滚一边去","滚远点",
      "不爽","不爽你","不爽就","看你不爽",
      "弄他","弄她","弄死","弄残",
      "砍死","劈死","剁死","捅死",
      "活该","活该死","死有余辜","罪有应得",
      "报应","遭报应","遭天谴","天打雷劈",
      "下地狱","下油锅","下十八层地狱",
      "死无葬身之地","死无全尸","死不瞑目",
      "断子绝孙","绝后","绝嗣","绝种",
      "全家","全家死","全家光","全家亡",
      "族谱","祖坟","挖祖坟","刨祖坟",
      "先人","祖宗十八代","祖上",
      "龟孙","龟儿子","龟孙子","龟公",
      "私生子","野种","杂种","野孩子",
      "小三","二奶","情妇","姘头","姘居",
      "戴绿帽","绿帽子","绿了","被绿",
      "老婊子","老婊","老骚货",
      "小婊子","小婊","小骚货",
      "男婊","女婊","人尽可夫",
      "破鞋","野鸡","站街","卖的","做鸡","做鸭",
      "淫娃","淫妇","淫虫","淫水","淫叫",
      "操入","操进","插入","插进","顶入","顶进",
      "口交","乳交","肛交","群交","滥交",
      "自慰","手淫","打飞机","撸管","撸","撸啊撸",
      "勃起","阳痿","早泄","勃起功能障碍",
      "月经","大姨妈","姨妈巾","卫生巾","带血",
      "裸体","裸照","裸睡","裸奔","裸聊",
      "偷拍","走光","春光乍泄","露点","露乳","露胸",
      "摸胸","摸奶","摸屁股","摸大腿","咸猪手",
      "性骚扰","猥亵儿童","恋童","恋童癖","萝莉控","正太控",
      "幼女","幼童","小孩","儿童","少年","少女",
      "强奸幼女","强暴幼女","猥亵幼女",
      "迷奸","迷药","春药","催情药","迷晕",
      "偷窥","偷看","窥视","窥探",
      "恋足","恋丝","恋物","SM","sm","调教",
      "捆绑","束缚","鞭打","滴蜡","虐恋",
      "3P","3p","多P","多p","群P","群p","换妻","换偶",
      "拍AV","拍黄片","拍裸照","拍性爱视频",
      "援交","包养","被包养","二奶村",
      "AV女优","AV男优","女优","男优",
      "成人片","成人电影","成人视频","成人直播",
      "啪啪啪","papapa","PaPaPa","啪啪","嘿嘿嘿",
      "上了你","上你","睡你","睡了你",
      "开苞","破处","破掉","第一次",
      "大波","巨乳","豪乳","爆乳","乳此","乳沟",
      "深喉","吞精","颜射","内射","外射",
      "肛塞","跳蛋","飞机杯","充气娃娃","自慰器",
      "约吗","约不","约炮","约啪","约一下",
      "qio","qia","qiao",
      "你妈","你爹","你爷","你奶","你婆","你姥",
      "傻B","傻b","装B","装b","撕B","撕b","苦B","苦b","二B","二b","骚B","骚b"
    ]
  };
}

// 旧数据迁移：members 字符串数组 → 对象数组；无 machines 时从 machineLabels 生成
function migrateLoaded(parsed, base) {
  var labels = Object.assign(base.machineLabels, parsed.machineLabels || {});
  var statusMap = Object.assign(base.machineStatus, parsed.machineStatus || {});
  // machines 迁移
  var machines;
  if (Array.isArray(parsed.machines) && parsed.machines.length) {
    machines = parsed.machines;
  } else {
    machines = [];
    // 保留默认 maimai/chunithm 顺序，再追加其他
    ["maimai", "chunithm"].forEach(function(k) {
      if (labels[k]) machines.push({ id: k, label: labels[k], status: statusMap[k] || "ok" });
    });
    Object.keys(labels).forEach(function(k) {
      if (k !== "maimai" && k !== "chunithm") machines.push({ id: k, label: labels[k], status: statusMap[k] || "ok" });
    });
  }
  // members 迁移：字符串数组 → 对象数组
  var members;
  if (Array.isArray(parsed.members)) {
    if (parsed.members.length && typeof parsed.members[0] === "string") {
      members = parsed.members.map(function(p) { return { phone: p, name: "", visits: 0 }; });
    } else {
      members = parsed.members;
    }
  } else {
    members = base.members;
  }
  return { machines: machines, members: members };
}

// 把解析后的数据合并到 state（本地文件和数据库共用）
function applyLoadedState(parsed) {
  const base = defaultState();
  var mig = migrateLoaded(parsed, base);
  state = {
    shopName: parsed.shopName != null ? parsed.shopName : base.shopName,
    tagline: parsed.tagline != null ? parsed.tagline : base.tagline,
    machines: mig.machines,
    machineLabels: Object.assign(base.machineLabels, parsed.machineLabels || {}),
    machineStatus: Object.assign(base.machineStatus, parsed.machineStatus || {}),
    prices: Array.isArray(parsed.prices) && parsed.prices.length ? parsed.prices : base.prices,
    scanCounter: Object.assign(base.scanCounter, parsed.scanCounter || {}),
    queues: Object.assign(base.queues, parsed.queues || {}),
    enqueuedAt: Object.assign(base.enqueuedAt, parsed.enqueuedAt || {}),
    current: Object.assign(base.current, parsed.current || {}),
    waitHistory: Object.assign(base.waitHistory, parsed.waitHistory || {}),
    membership: Object.assign(base.membership, parsed.membership || {}),
    members: mig.members,
    numberMeta: Object.assign({ maimai: {}, chunithm: {} }, parsed.numberMeta || {}),
    avatars: parsed.avatars && typeof parsed.avatars === "object" ? parsed.avatars : {},
    calledHistory: Array.isArray(parsed.calledHistory) ? parsed.calledHistory : [],
    bgImage: parsed.bgImage != null ? parsed.bgImage : base.bgImage,
    bgBrightness: parsed.bgBrightness != null ? parsed.bgBrightness : base.bgBrightness,
    consolePassword: parsed.consolePassword != null ? String(parsed.consolePassword) : base.consolePassword,
    autoCall: Object.assign(base.autoCall, parsed.autoCall || {}),
    callTime: parsed.callTime && typeof parsed.callTime === "object" ? parsed.callTime : {},
    closingTime: parsed.closingTime != null ? String(parsed.closingTime) : base.closingTime,
    posts: Array.isArray(parsed.posts) ? parsed.posts : [],
    announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
    blockedWords: Array.isArray(parsed.blockedWords) && parsed.blockedWords.length ? parsed.blockedWords : base.blockedWords
  };
  (state.machines || []).forEach(function(m) {
    if (!state.machineStatus) state.machineStatus = {};
    if (state.machineStatus[m.id] == null) state.machineStatus[m.id] = m.status || "ok";
    m.status = state.machineStatus[m.id];
    if (!state.machineLabels) state.machineLabels = {};
    if (state.machineLabels[m.id] == null) state.machineLabels[m.id] = m.label;
    m.label = state.machineLabels[m.id];
  });
}

let state = defaultState();
// 本地模式：同步读 state.json
if (!pgPool) {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    applyLoadedState(JSON.parse(raw));
  } catch (e) {}
}
// 云模式：异步从 PostgreSQL 加载（在 listen 前完成）
async function loadStateFromDB() {
  if (!pgPool) return;
  try {
    const r = await pgPool.query("SELECT value FROM kv_store WHERE key='state'");
    if (r.rows.length) applyLoadedState(r.rows[0].value);
    else await pgPool.query("INSERT INTO kv_store(key,value) VALUES('state',$1)", [JSON.stringify(state)]);
    console.log("[DB] state 已加载");
  } catch (e) { console.log("[DB] 加载 state 失败:", e.message); }
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    if (pgPool) {
      pgPool.query("INSERT INTO kv_store(key,value) VALUES('state',$1) ON CONFLICT(key) DO UPDATE SET value=$1", [JSON.stringify(state)])
        .catch(function(e){ console.log("[DB] persist 失败:", e.message); });
    } else {
      try { fs.writeFile(STATE_FILE, JSON.stringify(state), function () {}); } catch (e) {}
    }
  }, 800);
}

const clients = new Set();
function broadcast(message) {
  const payload = "data: " + JSON.stringify(message) + "\n\n";
  for (const res of clients) { try { res.write(payload); } catch (e) {} }
}
setInterval(function () {
  for (const res of clients) { try { res.write(": heartbeat\n\n"); } catch (e) {} }
}, 15000);

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req) {
  return new Promise(function (resolve) {
    let chunks = [];
    req.on("data", function (b) { chunks.push(b); });
    req.on("end", function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { resolve({}); } });
    req.on("error", function () { resolve({}); });
  });
}
const MIME = { ".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".txt":"text/plain; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon",".mp3":"audio/mpeg",".wav":"audio/wav",".webp":"image/webp",".gif":"image/gif" };
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/" || urlPath === "") urlPath = "/console.html";
  const filePath = path.join(__dirname, path.normalize(urlPath).replace(/^([\/\\])+/, ""));
  if (!filePath.startsWith(__dirname)) { sendJSON(res, 403, { error: "forbidden" }); return; }
  fs.readFile(filePath, function (err, data) {
    if (err) { sendJSON(res, 404, { error: "not found", path: urlPath }); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}
// 获取真实局域网 IP（排除虚拟网卡、回环、APIPA）
function lanIPs() {
  const ifaces = os.networkInterfaces();
  const result = [];
  for (const name in ifaces) {
    if (/^(vEthernet|WSL|Hyper-V|Docker|VirtualBox|VMware)/i.test(name)) continue;
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254")) {
        result.push({ address: iface.address, name: name });
      }
    }
  }
  return result;
}
function genScanNumber(machine) {
  if (state.scanCounter[machine] == null) state.scanCounter[machine] = 0;
  state.scanCounter[machine] += 1;
  return SCAN_PREFIX + String(state.scanCounter[machine]).padStart(3, "0");
}
// ===== 拦截词检查 =====
function checkBlocked(text) {
  var words = Array.isArray(state.blockedWords) ? state.blockedWords : [];
  if (!words.length || !text) return null;
  var lower = String(text).toLowerCase();
  for (var i = 0; i < words.length; i++) {
    var w = String(words[i]).trim().toLowerCase();
    if (w && lower.indexOf(w) >= 0) return words[i];
  }
  return null;
}
// ===== AI 内容审核（后台异步，违规自动撤回）=====
// 读取图片为 base64 data URL（云模式从 DB，本地模式从文件）
async function readImageAsDataURL(imgUrl) {
  try {
    var cleanUrl = imgUrl.split("?")[0];
    if (pgPool) {
      var imgId = cleanUrl.replace(/^\/api\/img\//, "");
      var r = await pgPool.query("SELECT mime, data FROM images WHERE id=$1", [imgId]);
      if (!r.rows.length) return null;
      return "data:" + r.rows[0].mime + ";base64," + r.rows[0].data;
    }
    var filePath = path.join(__dirname, cleanUrl.replace(/^\//, ""));
    if (!fs.existsSync(filePath)) return null;
    var buf = fs.readFileSync(filePath);
    var ext = path.extname(filePath).toLowerCase();
    var mime = "image/jpeg";
    if (ext === ".png") mime = "image/png";
    else if (ext === ".gif") mime = "image/gif";
    else if (ext === ".webp") mime = "image/webp";
    return "data:" + mime + ";base64," + buf.toString("base64");
  } catch (e) { return null; }
}
// 保存图片（云模式存 DB images 表，本地模式写 uploads/），返回 Promise<url>
function saveImage(imgData, ext, prefix) {
  var mime = "image/jpeg";
  if (ext === ".png") mime = "image/png";
  else if (ext === ".gif") mime = "image/gif";
  else if (ext === ".webp") mime = "image/webp";
  return new Promise(function (resolve, reject) {
    if (pgPool) {
      var id = prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      pgPool.query("INSERT INTO images(id, mime, data) VALUES($1, $2, $3)", [id, mime, imgData.toString("base64")])
        .then(function () { resolve("/api/img/" + id); })
        .catch(reject);
    } else {
      var fileName = prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + ext;
      var uploadDir = path.join(process.cwd(), "uploads");
      try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
      fs.writeFile(path.join(uploadDir, fileName), imgData, function (err) {
        if (err) reject(err); else resolve("/uploads/" + fileName + "?t=" + Date.now());
      });
    }
  });
}
// 抽取的单次 AI 审核请求：cb(replyText)
function callAIModeration(payload, cb) {
  var urlObj;
  try { urlObj = new URL(AI_MOD.url); } catch (e) { cb(""); return; }
  var options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 443,
    path: urlObj.pathname + (urlObj.search || ""),
    method: "POST",
    headers: {
      "Authorization": "Bearer " + AI_MOD.key,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  };
  var req = https.request(options, function (resp) {
    var data = "";
    resp.on("data", function (c) { data += c; });
    resp.on("end", function () {
      try {
        var parsed = JSON.parse(data);
        var reply = (parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content) || "";
        cb(String(reply).trim());
      } catch (e) { cb(""); }
    });
  });
  req.on("error", function () { cb(""); });
  req.write(payload);
  req.end();
}
// 判定单次回复是否违规
function isViolationReply(reply) {
  if (!reply) return false;
  return reply.indexOf("1") === 0 || reply === "1" || reply === "违规";
}
// 撤回帖子（含图片清理）
function revokePost(postId, reason) {
  if (!Array.isArray(state.posts)) return;
  for (var i = 0; i < state.posts.length; i++) {
    if (state.posts[i].id === postId) {
      var pImgs = state.posts[i].images || [];
      pImgs.forEach(function (u) {
        if (pgPool) {
          var imgId = String(u).split("?")[0].replace(/^\/api\/img\//, "");
          pgPool.query("DELETE FROM images WHERE id=$1", [imgId]).catch(function(){});
        } else {
          try {
            var fp = path.join(__dirname, String(u).split("?")[0].replace(/^\//, ""));
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          } catch (e) {}
        }
      });
      state.posts.splice(i, 1);
      persist();
      broadcast({ type: "sync", state: state });
      broadcast({ type: "post-removed", postId: postId, reason: reason });
      console.log("[AI审核] 帖子 " + postId + " " + reason + "（含图片清理）");
      break;
    }
  }
}
async function aiModeratePost(post) {
  if (!AI_MOD.enabled) return;
  var basePrompt = "你是一名音游社区（音游窝）的内容审核员，负责守护社区氛围。"
    + "你的任务是判断用户发布的内容是否违规。\n"
    + "违规标准：人身攻击、辱骂、脏话、色情低俗裸露、毒品赌博、政治敏感、广告引流、诈骗、人肉隐私、煽动暴力、违法违规内容。图片含色情/暴力/血腥/违法违规元素也视为违规。\n"
    + "正常讨论音游玩法、约拼机、晒成绩截图、技术交流、闲聊属于合规内容。\n"
    + "判断依据：整体语义和图片内容，不拘泥于单个词汇。\n"
    + "输出规则：只回复一个字符，违规回复\"1\"，正常回复\"0\"。禁止任何解释、标点、多余文字。";
  var postText = "分类：" + (post.cat || "讨论") + "\n"
    + "标题：" + (post.title || "") + "\n"
    + "内容：" + (post.content || "");
  var imgs = Array.isArray(post.images) ? post.images.slice(0, 6) : [];
  // 任务列表：文字单独审核 + 每张图片逐张单独审核（避免混图漏检）
  var tasks = [];
  tasks.push({
    label: "文字",
    payload: JSON.stringify({
      model: AI_MOD.model,
      messages: [
        { role: "system", content: basePrompt },
        { role: "user", content: "请审核以下帖子文字内容：\n" + postText }
      ],
      temperature: 0.1,
      max_tokens: 5
    })
  });
  for (var ii = 0; ii < imgs.length; ii++) {
    var dataUrl = await readImageAsDataURL(imgs[ii]);
    if (!dataUrl) continue;
    tasks.push({
      label: "图片" + (ii + 1),
      payload: JSON.stringify({
        model: AI_MOD.model,
        messages: [
          { role: "system", content: basePrompt + "\n本次仅审核一张图片本身是否违规。" },
          { role: "user", content: [
            { type: "text", text: "请仅判断下面这张图片是否违规（帖子文字背景：\n" + postText + "\n）。" },
            { type: "image_url", image_url: { url: dataUrl } }
          ] }
        ],
        temperature: 0.1,
        max_tokens: 5
      })
    });
  }
  var settled = false;
  var remaining = tasks.length;
  function settleViolation(reason, label) {
    if (settled) return;
    settled = true;
    console.log("[AI审核] 帖子 " + post.id + " " + label + " 违规 → 撤回");
    revokePost(post.id, reason);
  }
  function onTaskReply(label, reply) {
    console.log("[AI审核] 帖子 " + post.id + " " + label + " 模型回复:", JSON.stringify(reply));
    if (isViolationReply(reply)) {
      settleViolation("AI审核：" + label + "违规已撤回", label);
      return;
    }
    remaining--;
    if (remaining <= 0 && !settled) {
      settled = true;
      console.log("[AI审核] 帖子 " + post.id + " 全部通过（" + tasks.length + " 项）");
    }
  }
  // 并行发起所有审核请求
  tasks.forEach(function (t) {
    callAIModeration(t.payload, function (reply) { onTaskReply(t.label, reply); });
  });
}
// ===== 动态机台校验 =====
function machineExists(id) {
  return (state.machines || []).some(function (m) { return m.id === id; });
}
function findMachine(id) {
  var arr = (state.machines || []).filter(function (m) { return m.id === id; });
  return arr.length > 0 ? arr[0] : null;
}
function machineLabel(id) {
  var m = findMachine(id);
  return m ? m.label : id;
}
// ===== 会员（对象数组）校验与查询 =====
function normalizePhone(phone) {
  return phone ? String(phone).replace(/\D/g, "") : "";
}
function findMember(phone) {
  var p = normalizePhone(phone);
  if (!p) return null;
  var arr = (state.members || []).filter(function (m) { return normalizePhone(m.phone) === p; });
  return arr.length > 0 ? arr[0] : null;
}
function isMemberPhone(phone) {
  return !!findMember(phone);
}
function memberName(phone) {
  var m = findMember(phone);
  return m ? (m.name || "") : "";
}
function memberVisits(phone) {
  var m = findMember(phone);
  return m ? (m.visits || 0) : 0;
}
function isVipMember(phone) {
  return memberVisits(phone) >= VIP_THRESHOLD;
}
// 叫号时累计次数：visits+1，达到阈值标记 vip，同步该号码所有 numberMeta
function addMemberVisit(phone) {
  var m = findMember(phone);
  if (!m) return null;
  m.visits = (m.visits || 0) + 1;
  if (m.visits >= VIP_THRESHOLD) m.vip = true; else m.vip = false;
  var p = normalizePhone(phone);
  if (state.numberMeta) {
    Object.keys(state.numberMeta).forEach(function (mc) {
      var mm = state.numberMeta[mc] || {};
      Object.keys(mm).forEach(function (num) {
        var meta = mm[num];
        if (meta && normalizePhone(meta.phone) === p) {
          meta.vip = m.visits >= VIP_THRESHOLD;
          meta.visits = m.visits;
          if (m.name) meta.name = m.name;
        }
      });
    });
  }
  return m;
}
function setMemberName(phone, name) {
  var m = findMember(phone);
  if (!m) return false;
  m.name = name || "";
  return true;
}
function getAvatar(phone) {
  var p = normalizePhone(phone);
  return (state.avatars && state.avatars[p]) || null;
}
function setNumberMeta(machine, number, meta) {
  if (!state.numberMeta) state.numberMeta = {};
  if (!state.numberMeta[machine]) state.numberMeta[machine] = {};
  state.numberMeta[machine][number] = meta || {};
}
function clearNumberMeta(machine, number) {
  if (state.numberMeta && state.numberMeta[machine] && state.numberMeta[machine][number]) {
    delete state.numberMeta[machine][number];
  }
}
function enqueue(machine, number, source) {
  if (!state.queues[machine]) state.queues[machine] = [];
  if (!state.enqueuedAt[machine]) state.enqueuedAt[machine] = {};
  state.queues[machine].push(number);
  state.enqueuedAt[machine][number] = Date.now();
}
function avgWaitMin(machine) {
  var h = (state.waitHistory && state.waitHistory[machine]) || [];
  if (h.length === 0) return 0;
  var recent = h.slice(-10);
  var sum = recent.reduce(function (a, b) { return a + b; }, 0);
  return Math.round((sum / recent.length) * 10) / 10;
}
function estimateWaitMin(machine, number) {
  var q = state.queues[machine] || [];
  var idx = q.indexOf(number);
  if (idx < 0) return 0;
  var avg = avgWaitMin(machine);
  if (avg <= 0) avg = 5;
  return Math.round(idx * avg * 10) / 10;
}
const server = http.createServer(async function (req, res) {
  const urlPath = req.url.split("?")[0];
  if (urlPath === "/api/events" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write("\n"); clients.add(res);
    res.write("data: " + JSON.stringify({ type: "sync", state: state }) + "\n\n");
    req.on("close", function () { clients.delete(res); }); return;
  }
  if (urlPath === "/api/state" && req.method === "GET") { sendJSON(res, 200, state); return; }
  // 图片读取（云模式从 DB images 表返回图片二进制）
  if (urlPath.indexOf("/api/img/") === 0 && req.method === "GET") {
    var imgId = urlPath.replace(/^\/api\/img\//, "");
    if (pgPool) {
      pgPool.query("SELECT mime, data FROM images WHERE id=$1", [imgId]).then(function (r) {
        if (!r.rows.length) { res.writeHead(404); res.end(); return; }
        var buf = Buffer.from(r.rows[0].data, "base64");
        res.writeHead(200, { "Content-Type": r.rows[0].mime, "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
        res.end(buf);
      }).catch(function () { res.writeHead(500); res.end(); });
    } else { serveStatic(req, res); }
    return;
  }
  // 控制台登录校验
  if (urlPath === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const pwd = String(body.password || "");
    const ok = pwd === String(state.consolePassword || "123456");
    sendJSON(res, 200, { ok: ok });
    return;
  }
  // 修改控制台密码
  if (urlPath === "/api/password" && req.method === "POST") {
    const body = await readBody(req);
    const oldPwd = String(body.old || ""), newPwd = String(body.new || "");
    if (oldPwd !== String(state.consolePassword || "123456")) { sendJSON(res, 400, { error: "原密码错误" }); return; }
    if (newPwd.length < 4) { sendJSON(res, 400, { error: "新密码至少4位" }); return; }
    state.consolePassword = newPwd; persist();
    sendJSON(res, 200, { ok: true });
    return;
  }
  // 系统设置（自动叫号 / 打烊时间）
  if (urlPath === "/api/settings" && req.method === "POST") {
    const body = await readBody(req);
    if (body.autoCall && typeof body.autoCall === "object") {
      state.autoCall = {
        enabled: !!body.autoCall.enabled,
        duration: Math.max(1, Math.min(60, parseInt(body.autoCall.duration, 10) || 8))
      };
    }
    if (body.closingTime != null) {
      var ct = String(body.closingTime).trim();
      if (ct && !/^\d{1,2}:\d{2}$/.test(ct)) { sendJSON(res, 400, { error: "时间格式应为 HH:MM" }); return; }
      state.closingTime = ct;
    }
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, autoCall: state.autoCall, closingTime: state.closingTime });
    return;
  }
  if (urlPath === "/api/lan-ip" && req.method === "GET") {
    sendJSON(res, 200, { ips: lanIPs(), port: PORT }); return;
  }
  // 取号（支持会员名称）
  if (urlPath === "/api/take" && req.method === "POST") {
    const body = await readBody(req);
    const machine = body.machine;
    if (!machineExists(machine)) { sendJSON(res, 400, { error: "无效的机台" }); return; }
    if (state.machineStatus && state.machineStatus[machine] === "repair") { sendJSON(res, 400, { error: "该机台维护中，暂停取号" }); return; }
    const phone = body.phone ? String(body.phone).trim() : "";
    // 防重复取号：会员用手机号，非会员用 IP
    var clientId = phone || (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (state.queues[machine]) {
      for (var i = 0; i < state.queues[machine].length; i++) {
        var n = state.queues[machine][i];
        var meta = state.numberMeta && state.numberMeta[machine] && state.numberMeta[machine][n];
        var existId = (meta && meta.phone) ? meta.phone : (meta && meta.clientId);
        if (existId && existId === clientId) {
          sendJSON(res, 400, { error: "您已有号码在排队，请等待叫号", number: n });
          return;
        }
      }
    }
    if (state.current[machine]) {
      var curMeta = state.numberMeta && state.numberMeta[machine] && state.numberMeta[machine][state.current[machine]];
      var curId = (curMeta && curMeta.phone) ? curMeta.phone : (curMeta && curMeta.clientId);
      if (curId && curId === clientId) {
        sendJSON(res, 400, { error: "您当前正在被叫号，请前往游玩", number: state.current[machine] });
        return;
      }
    }
    const member = isMemberPhone(phone);
    const avatar = member ? getAvatar(phone) : null;
    var mname = "";
    var vip = false;
    var visits = 0;
    if (member) {
      visits = memberVisits(phone);
      vip = isVipMember(phone);
      // 取号时若填了自定义名称，更新会员名称；否则用已有名称
      var inputName = body.name ? String(body.name).trim() : "";
      if (inputName) { setMemberName(phone, inputName); mname = inputName; }
      else { mname = memberName(phone); }
    }
    const number = genScanNumber(machine);
    enqueue(machine, number, "scan");
    setNumberMeta(machine, number, { member: member, phone: member ? phone : "", clientId: clientId, avatar: avatar, name: mname, vip: vip, visits: visits });
    persist();
    const ahead = state.queues[machine].length - 1;
    const estMin = estimateWaitMin(machine, number);
    broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, number: number, machine: machine, ahead: ahead, estMin: estMin, isMember: member, avatar: avatar, name: mname, vip: vip, visits: visits });
    return;
  }
  // 检查会员（返回完整信息）
  if (urlPath === "/api/check-member" && req.method === "POST") {
    const body = await readBody(req);
    const phone = body.phone ? String(body.phone).trim() : "";
    var isMem = isMemberPhone(phone);
    sendJSON(res, 200, { isMember: isMem, name: memberName(phone), visits: memberVisits(phone), vip: isVipMember(phone), avatar: getAvatar(phone) });
    return;
  }
  // 切换机台状态（ok / repair）
  if (urlPath === "/api/machine-status" && req.method === "POST") {
    const body = await readBody(req);
    const m = body.machine, st = body.status;
    if (!machineExists(m) || (st !== "ok" && st !== "repair")) {
      sendJSON(res, 400, { error: "参数无效" }); return;
    }
    if (!state.machineStatus) state.machineStatus = {};
    state.machineStatus[m] = st;
    var mc = findMachine(m);
    if (mc) mc.status = st;
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, machineStatus: state.machineStatus, machines: state.machines });
    return;
  }
  // 新增机台
  if (urlPath === "/api/machine-add" && req.method === "POST") {
    const body = await readBody(req);
    var label = body.label ? String(body.label).trim() : "新机台";
    var id = "m" + Date.now();
    if (!Array.isArray(state.machines)) state.machines = [];
    state.machines.push({ id: id, label: label, status: "ok" });
    if (!state.machineLabels) state.machineLabels = {};
    state.machineLabels[id] = label;
    if (!state.machineStatus) state.machineStatus = {};
    state.machineStatus[id] = "ok";
    if (!state.scanCounter) state.scanCounter = {};
    state.scanCounter[id] = 0;
    if (!state.queues) state.queues = {};
    state.queues[id] = [];
    if (!state.enqueuedAt) state.enqueuedAt = {};
    state.enqueuedAt[id] = {};
    if (!state.current) state.current = {};
    state.current[id] = null;
    if (!state.waitHistory) state.waitHistory = {};
    state.waitHistory[id] = [];
    if (!state.numberMeta) state.numberMeta = {};
    state.numberMeta[id] = {};
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, machines: state.machines });
    return;
  }
  // 删除机台（清空相关数据）
  if (urlPath === "/api/machine-remove" && req.method === "POST") {
    const body = await readBody(req);
    const id = body.id;
    if (!id) { sendJSON(res, 400, { error: "缺少 id" }); return; }
    if (!machineExists(id)) { sendJSON(res, 400, { error: "机台不存在" }); return; }
    state.machines = (state.machines || []).filter(function (m) { return m.id !== id; });
    if (state.machineLabels) delete state.machineLabels[id];
    if (state.machineStatus) delete state.machineStatus[id];
    if (state.scanCounter) delete state.scanCounter[id];
    if (state.queues) delete state.queues[id];
    if (state.enqueuedAt) delete state.enqueuedAt[id];
    if (state.current) delete state.current[id];
    if (state.waitHistory) delete state.waitHistory[id];
    if (state.numberMeta) delete state.numberMeta[id];
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, machines: state.machines });
    return;
  }
  // 重命名机台
  if (urlPath === "/api/machine-rename" && req.method === "POST") {
    const body = await readBody(req);
    const id = body.id, label = body.label ? String(body.label).trim() : "";
    if (!id || !label) { sendJSON(res, 400, { error: "缺少 id/label" }); return; }
    if (!machineExists(id)) { sendJSON(res, 400, { error: "机台不存在" }); return; }
    (state.machines || []).forEach(function (m) { if (m.id === id) m.label = label; });
    if (!state.machineLabels) state.machineLabels = {};
    state.machineLabels[id] = label;
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, machines: state.machines });
    return;
  }
  // 添加会员（含名称）
  if (urlPath === "/api/member-add" && req.method === "POST") {
    const body = await readBody(req);
    const phone = body.phone ? String(body.phone).trim() : "";
    const name = body.name ? String(body.name).trim() : "";
    if (!phone) { sendJSON(res, 400, { error: "手机号为空" }); return; }
    if (!Array.isArray(state.members)) state.members = [];
    if (!isMemberPhone(phone)) {
      state.members.push({ phone: phone, name: name, visits: 0 });
      persist(); broadcast({ type: "sync", state: state });
      sendJSON(res, 200, { ok: true, members: state.members });
    } else {
      if (name) setMemberName(phone, name);
      persist(); broadcast({ type: "sync", state: state });
      sendJSON(res, 200, { ok: true, members: state.members, exists: true });
    }
    return;
  }
  // 删除会员
  if (urlPath === "/api/member-remove" && req.method === "POST") {
    const body = await readBody(req);
    const phone = body.phone ? String(body.phone).trim() : "";
    if (!phone) { sendJSON(res, 400, { error: "手机号为空" }); return; }
    const p = normalizePhone(phone);
    state.members = (state.members || []).filter(function (m) { return normalizePhone(m.phone) !== p; });
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, members: state.members });
    return;
  }
  // 更新会员名称
  if (urlPath === "/api/member-update" && req.method === "POST") {
    const body = await readBody(req);
    const phone = body.phone ? String(body.phone).trim() : "";
    const name = body.name != null ? String(body.name).trim() : "";
    if (!phone) { sendJSON(res, 400, { error: "手机号为空" }); return; }
    if (!isMemberPhone(phone)) { sendJSON(res, 400, { error: "会员不存在" }); return; }
    setMemberName(phone, name);
    // 同步该会员所有 numberMeta 的 name
    var pp = normalizePhone(phone);
    if (state.numberMeta) {
      Object.keys(state.numberMeta).forEach(function (mc) {
        var mm = state.numberMeta[mc] || {};
        Object.keys(mm).forEach(function (num) {
          if (mm[num] && normalizePhone(mm[num].phone) === pp) mm[num].name = name;
        });
      });
    }
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, members: state.members });
    return;
  }
  // 上传会员头像（multipart/form-data，字段 file + phone）
  if (urlPath === "/api/upload-avatar" && req.method === "POST") {
    const boundary = (req.headers["content-type"] || "").match(/boundary=(.*)$/);
    if (!boundary) { sendJSON(res, 400, { error: "缺少 boundary" }); return; }
    const MAX_AVATAR = 3 * 1024 * 1024;
    let totalSize = 0, tooLarge = false;
    const chunks = [];
    req.on("data", function (b) {
      totalSize += b.length;
      if (totalSize > MAX_AVATAR) { tooLarge = true; return; }
      chunks.push(b);
    });
    req.on("end", function () {
      try {
        if (tooLarge) { sendJSON(res, 413, { error: "图片过大（超过 3MB），请压缩后重试" }); return; }
        const buf = Buffer.concat(chunks);
        const bnd = "--" + boundary[1];
        const parts = buf.toString("binary").split(bnd);
        let imgData = null, ext = ".jpg", phone = "";
        for (const p of parts) {
          if (p.indexOf("Content-Disposition") < 0) continue;
          const nameM = p.match(/name="([^"]+)"/);
          const fileM = p.match(/filename="([^"]+)"/);
          const headerEnd = p.indexOf("\r\n\r\n");
          if (headerEnd < 0) continue;
          const val = p.substring(headerEnd + 4).replace(/\r\n$/, "");
          if (nameM && nameM[1] === "phone") {
            phone = val;
          } else if (fileM && fileM[1]) {
            const fn = fileM[1].toLowerCase();
            if (/\.png$/.test(fn)) ext = ".png";
            else if (/\.gif$/.test(fn)) ext = ".gif";
            else if (/\.webp$/.test(fn)) ext = ".webp";
            else ext = ".jpg";
            imgData = Buffer.from(val, "binary");
          }
        }
        if (!imgData || imgData.length === 0) { sendJSON(res, 400, { error: "未收到图片数据" }); return; }
        phone = String(phone || "").replace(/\D/g, "");
        if (!phone) { sendJSON(res, 400, { error: "缺少手机号" }); return; }
        saveImage(imgData, ext, "avatar_" + phone).then(function (url) {
          if (!state.avatars) state.avatars = {};
          state.avatars[phone] = url;
          persist();
          broadcast({ type: "sync", state: state });
          sendJSON(res, 200, { ok: true, avatar: url });
        }).catch(function (err) {
          console.log("头像保存失败:", err.message);
          sendJSON(res, 500, { error: "保存失败: " + err.message });
        });
      } catch (e) { sendJSON(res, 500, { error: "解析失败" }); }
    });
    return;
  }
  if (urlPath === "/api/status" && req.method === "GET") {
    const qs = req.url.split("?")[1] || "";
    const params = new URLSearchParams(qs);
    const machine = params.get("machine");
    const number = params.get("number");
    if (!machine || !number) { sendJSON(res, 400, { error: "缺少 machine/number" }); return; }
    const q = state.queues[machine] || [];
    const idx = q.indexOf(number);
    const called = state.current[machine] === number;
    sendJSON(res, 200, { number: number, machine: machine, inQueue: idx >= 0, ahead: idx < 0 ? -1 : idx, called: called, estMin: idx >= 0 ? estimateWaitMin(machine, number) : 0, avgMin: avgWaitMin(machine) });
    return;
  }
  // 顾客主动放弃号码
  if (urlPath === "/api/cancel" && req.method === "POST") {
    const body = await readBody(req);
    const m = body.machine, num = body.number ? String(body.number).trim() : "";
    if (!m || !num) { sendJSON(res, 400, { error: "缺少 machine/number" }); return; }
    if (!machineExists(m)) { sendJSON(res, 400, { error: "无效机台" }); return; }
    if (state.queues[m]) {
      const idx = state.queues[m].indexOf(num);
      if (idx >= 0) {
        state.queues[m].splice(idx, 1);
        if (state.enqueuedAt[m] && state.enqueuedAt[m][num]) delete state.enqueuedAt[m][num];
        clearNumberMeta(m, num);
        persist(); broadcast({ type: "sync", state: state });
        sendJSON(res, 200, { ok: true, removed: true });
      } else {
        sendJSON(res, 200, { ok: true, removed: false });
      }
    } else { sendJSON(res, 400, { error: "无效机台" }); }
    return;
  }
  // 上传背景图片
  if (urlPath === "/api/upload-bg" && req.method === "POST") {
    const boundary = (req.headers["content-type"] || "").match(/boundary=(.*)$/);
    if (!boundary) { sendJSON(res, 400, { error: "缺少 boundary" }); return; }
    const MAX_BG = 10 * 1024 * 1024;
    let totalBgSize = 0, bgTooLarge = false;
    const chunks = [];
    req.on("data", function (b) { totalBgSize += b.length; if (totalBgSize > MAX_BG) { bgTooLarge = true; return; } chunks.push(b); });
    req.on("end", function () {
      try {
        if (bgTooLarge) { sendJSON(res, 413, { error: "图片过大（超过 10MB），请压缩后重试" }); return; }
        const buf = Buffer.concat(chunks);
        const bnd = "--" + boundary[1];
        const parts = buf.toString("binary").split(bnd);
        let imgData = null, ext = ".jpg";
        for (const p of parts) {
          if (p.indexOf("Content-Disposition") < 0) continue;
          const m = p.match(/filename="([^"]+)"/);
          if (m && m[1]) {
            const fn = m[1].toLowerCase();
            if (/\.png$/.test(fn)) ext = ".png";
            else if (/\.gif$/.test(fn)) ext = ".gif";
            else if (/\.webp$/.test(fn)) ext = ".webp";
            else ext = ".jpg";
          }
          const headerEnd = p.indexOf("\r\n\r\n");
          if (headerEnd >= 0) {
            imgData = Buffer.from(p.substring(headerEnd + 4).replace(/\r\n$/, ""), "binary");
          }
        }
        if (!imgData || imgData.length === 0) { sendJSON(res, 400, { error: "未收到图片数据" }); return; }
        saveImage(imgData, ext, "bg").then(function (url) {
          state.bgImage = url;
          persist();
          broadcast({ type: "sync", state: state });
          sendJSON(res, 200, { ok: true, bgImage: url });
        }).catch(function (err) {
          console.log("背景图保存失败:", err.message);
          sendJSON(res, 500, { error: "保存失败: " + err.message });
        });
      } catch (e) { sendJSON(res, 500, { error: "解析失败" }); }
    });
    return;
  }
  // 调整背景亮度
  if (urlPath === "/api/bg-settings" && req.method === "POST") {
    const body = await readBody(req);
    if (body && typeof body.brightness === "number") {
      state.bgBrightness = Math.max(0, Math.min(100, body.brightness));
      persist(); broadcast({ type: "sync", state: state });
      sendJSON(res, 200, { ok: true, bgBrightness: state.bgBrightness });
    } else { sendJSON(res, 400, { error: "缺少 brightness" }); }
    return;
  }
  // 清除背景图片
  if (urlPath === "/api/bg-clear" && req.method === "POST") {
    if (state.bgImage) {
      if (pgPool) {
        var bgId = state.bgImage.split("?")[0].replace(/^\/api\/img\//, "");
        pgPool.query("DELETE FROM images WHERE id=$1", [bgId]).catch(function(){});
      } else {
        const oldFile = state.bgImage.split("?")[0];
        try { fs.unlink(path.join(process.cwd(), oldFile), function () {}); } catch (e) {}
      }
      state.bgImage = null; persist(); broadcast({ type: "sync", state: state });
      sendJSON(res, 200, { ok: true }); return;
    }
    state.bgImage = null; persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true }); return;
  }
  // 全量同步（机台/会员等由服务端为准，队列等业务数据从客户端）
  if (urlPath === "/api/sync" && req.method === "POST") {
    const body = await readBody(req);
    if (body && body.state) {
      const s = body.state;
      state = {
        shopName: s.shopName != null ? s.shopName : state.shopName,
        tagline: s.tagline != null ? s.tagline : state.tagline,
        machines: state.machines,
        machineLabels: state.machineLabels,
        machineStatus: state.machineStatus,
        prices: Array.isArray(s.prices) ? s.prices : state.prices,
        scanCounter: Object.assign({}, state.scanCounter, s.scanCounter || {}),
        queues: Object.assign({}, state.queues, s.queues || {}),
        enqueuedAt: Object.assign({}, state.enqueuedAt, s.enqueuedAt || {}),
        current: Object.assign({}, state.current, s.current || {}),
        waitHistory: Object.assign({}, state.waitHistory, s.waitHistory || {}),
        membership: Object.assign({ log: [] }, s.membership || {}),
        members: state.members,
        numberMeta: state.numberMeta,
        avatars: state.avatars,
        calledHistory: state.calledHistory,
        bgImage: state.bgImage,
        bgBrightness: state.bgBrightness,
        consolePassword: state.consolePassword,
        autoCall: state.autoCall,
        callTime: state.callTime,
        closingTime: state.closingTime,
        posts: state.posts,
        announcements: state.announcements
      };
      persist(); broadcast({ type: "sync", state: state }); sendJSON(res, 200, { ok: true });
    } else { sendJSON(res, 400, { error: "missing state" }); } return;
  }
  // 叫号：累计会员次数，broadcast 带 name/vip
  if (urlPath === "/api/call" && req.method === "POST") {
    const body = await readBody(req);
    if (body && body.machine && body.number != null) {
      const m = body.machine, num = body.number;
      if (!machineExists(m)) { sendJSON(res, 400, { error: "无效机台" }); return; }
      state.current[m] = num;
      if (!state.callTime) state.callTime = {};
      state.callTime[m] = num ? Date.now() : 0;
      var meta = (num && state.numberMeta && state.numberMeta[m] && state.numberMeta[m][num]) || {};
      var callName = "", callVip = false, callMember = false, callAvatar = null;
      if (num && meta.member && meta.phone) {
        callMember = true;
        callAvatar = meta.avatar || null;
        callName = meta.name || memberName(meta.phone) || "";
        var mb = addMemberVisit(meta.phone);
        if (mb) {
          callVip = (mb.visits || 0) >= VIP_THRESHOLD;
          meta.vip = callVip;
          meta.visits = mb.visits;
          if (mb.name) { meta.name = mb.name; callName = mb.name; }
          state.numberMeta[m][num] = meta;
        }
      }
      // 叫号后从队列移除（服务端同步）
      if (num && state.queues[m]) {
        var qi = state.queues[m].indexOf(num);
        if (qi >= 0) state.queues[m].splice(qi, 1);
      }
      try {
        var enq = state.enqueuedAt[m] && state.enqueuedAt[m][num];
        if (enq) {
          var waitMin = Math.round(((Date.now() - enq) / 60000) * 10) / 10;
          if (waitMin >= 0) {
            if (!state.waitHistory[m]) state.waitHistory[m] = [];
            state.waitHistory[m].push(waitMin);
            if (state.waitHistory[m].length > 50) state.waitHistory[m] = state.waitHistory[m].slice(-50);
          }
          delete state.enqueuedAt[m][num];
        }
      } catch (e) {}
      // 推入叫号历史（保留最近5个）
      if (num) {
        if (!Array.isArray(state.calledHistory)) state.calledHistory = [];
        state.calledHistory.push({ machine: m, number: num, name: callName, member: callMember, vip: callVip, avatar: callAvatar, time: Date.now() });
        if (state.calledHistory.length > 5) state.calledHistory = state.calledHistory.slice(-5);
      }
      persist();
      broadcast({ type: "sync", state: state });
      broadcast({ type: "call", machine: m, number: num, name: callName, vip: callVip, member: callMember, avatar: callAvatar });
      sendJSON(res, 200, { ok: true });
    } else { sendJSON(res, 400, { error: "missing machine/number" }); } return;
  }
  if (urlPath === "/api/enqueue" && req.method === "POST") {
    const body = await readBody(req);
    if (body && body.machine && body.number != null) {
      const m = body.machine, num = String(body.number).trim();
      if (!machineExists(m)) { sendJSON(res, 400, { error: "无效机台" }); return; }
      if (!num) { sendJSON(res, 400, { error: "号码为空" }); return; }
      if (num.toUpperCase().indexOf(SCAN_PREFIX) === 0) { sendJSON(res, 400, { error: "C 开头为扫码取号专用前缀，请手动输入其他号码" }); return; }
      enqueue(m, num, "manual"); persist(); broadcast({ type: "sync", state: state }); sendJSON(res, 200, { ok: true, number: num });
    } else { sendJSON(res, 400, { error: "missing machine/number" }); } return;
  }
  if (urlPath === "/api/remove" && req.method === "POST") {
    const body = await readBody(req);
    if (body && body.machine && body.index != null) {
      const m = body.machine, i = parseInt(body.index, 10);
      if (!machineExists(m)) { sendJSON(res, 400, { error: "无效机台" }); return; }
      if (state.queues[m] && i >= 0 && i < state.queues[m].length) {
        var removed = state.queues[m].splice(i, 1)[0];
        if (state.enqueuedAt[m] && state.enqueuedAt[m][removed]) delete state.enqueuedAt[m][removed];
        clearNumberMeta(m, removed);
        persist(); broadcast({ type: "sync", state: state }); sendJSON(res, 200, { ok: true });
      } else { sendJSON(res, 400, { error: "索引无效" }); }
    } else { sendJSON(res, 400, { error: "missing machine/index" }); } return;
  }
  if (urlPath === "/api/reset" && req.method === "POST") {
    state = defaultState(); persist(); broadcast({ type: "sync", state: state }); sendJSON(res, 200, { ok: true }); return;
  }
  // ===== 论坛帖子 API =====
  // 获取帖子列表（可带 keyword 搜索、cat 分类、authorPhone 我的）
  if (urlPath === "/api/posts" && req.method === "GET") {
    const qs = req.url.split("?")[1] || "";
    const params = new URLSearchParams(qs);
    var keyword = (params.get("keyword") || "").trim().toLowerCase();
    var cat = (params.get("cat") || "").trim();
    var authorPhone = (params.get("authorPhone") || "").trim();
    var list = Array.isArray(state.posts) ? state.posts.slice() : [];
    if (cat && cat !== "全部") list = list.filter(function (p) { return p.cat === cat; });
    if (authorPhone) list = list.filter(function (p) { return p.authorPhone === authorPhone; });
    if (keyword) {
      list = list.filter(function (p) {
        return (p.title && String(p.title).toLowerCase().indexOf(keyword) >= 0)
          || (p.content && String(p.content).toLowerCase().indexOf(keyword) >= 0)
          || (p.authorName && String(p.authorName).toLowerCase().indexOf(keyword) >= 0);
      });
    }
    list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    sendJSON(res, 200, { ok: true, posts: list });
    return;
  }
  // 发布帖子
  if (urlPath === "/api/posts" && req.method === "POST") {
    const body = await readBody(req);
    var title = (body.title || "").trim();
    var content = (body.content || "").trim();
    var pcat = (body.cat || "讨论").trim();
    var aPhone = (body.authorPhone || "").trim();
    var aName = (body.authorName || "").trim();
    var aVip = !!body.authorVip;
    var aMember = !!body.authorMember;
    var aAvatar = body.authorAvatar ? String(body.authorAvatar) : null;
    var imgs = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
    if (!title && !content) { sendJSON(res, 400, { error: "标题或内容不能为空" }); return; }
    if (!aPhone) { sendJSON(res, 400, { error: "未登录" }); return; }
    var hitTitle = checkBlocked(title);
    var hitContent = checkBlocked(content);
    if (hitTitle || hitContent) { sendJSON(res, 400, { error: "内容包含违规词汇，请修改后再发布" }); return; }
    var post = {
      id: "p" + Date.now() + Math.random().toString(36).slice(2, 6),
      title: title,
      content: content,
      cat: pcat,
      authorPhone: aPhone,
      authorName: aName,
      authorVip: aVip,
      authorMember: aMember,
      authorAvatar: aAvatar,
      images: imgs,
      likes: 0,
      likedBy: [],
      views: 0,
      comments: [],
      createdAt: Date.now()
    };
    if (!Array.isArray(state.posts)) state.posts = [];
    state.posts.unshift(post);
    if (state.posts.length > 500) state.posts = state.posts.slice(0, 500);
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, post: post });
    // 后台静默 AI 审核（不阻塞响应）
    aiModeratePost(post);
    return;
  }
  // 删除帖子（仅作者或管理员）
  if (urlPath === "/api/posts/delete" && req.method === "POST") {
    const body = await readBody(req);
    var pid = body.id || "";
    var byPhone = (body.byPhone || "").trim();
    var isAdmin = !!body.isAdmin;
    if (!Array.isArray(state.posts)) state.posts = [];
    var before = state.posts.length;
    state.posts = state.posts.filter(function (p) {
      if (p.id !== pid) return true;
      if (isAdmin) return false;
      if (byPhone && p.authorPhone === byPhone) return false;
      return true;
    });
    if (state.posts.length !== before) {
      persist(); broadcast({ type: "sync", state: state });
      sendJSON(res, 200, { ok: true });
    } else {
      sendJSON(res, 400, { error: "无权删除或帖子不存在" });
    }
    return;
  }
  // 点赞 / 取消点赞
  if (urlPath === "/api/posts/like" && req.method === "POST") {
    const body = await readBody(req);
    var pid = body.id || "";
    var lphone = (body.phone || "").trim();
    if (!lphone) { sendJSON(res, 400, { error: "未登录" }); return; }
    if (!Array.isArray(state.posts)) state.posts = [];
    var target = null;
    for (var i = 0; i < state.posts.length; i++) { if (state.posts[i].id === pid) { target = state.posts[i]; break; } }
    if (!target) { sendJSON(res, 400, { error: "帖子不存在" }); return; }
    if (!Array.isArray(target.likedBy)) target.likedBy = [];
    var idx = target.likedBy.indexOf(lphone);
    if (idx >= 0) { target.likedBy.splice(idx, 1); target.likes = Math.max(0, (target.likes || 0) - 1); }
    else { target.likedBy.push(lphone); target.likes = (target.likes || 0) + 1; }
    persist();
    broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, likes: target.likes, liked: target.likedBy.indexOf(lphone) >= 0 });
    return;
  }
  // 评论
  if (urlPath === "/api/posts/comment" && req.method === "POST") {
    const body = await readBody(req);
    var cpid = body.id || "";
    var cphone = (body.phone || "").trim();
    var cname = (body.name || "").trim();
    var ctext = (body.text || "").trim();
    if (!cphone || !ctext) { sendJSON(res, 400, { error: "参数缺失" }); return; }
    var hitComment = checkBlocked(ctext);
    if (hitComment) { sendJSON(res, 400, { error: "评论包含违规词汇，请修改后再发送" }); return; }
    if (!Array.isArray(state.posts)) state.posts = [];
    var cTarget = null;
    for (var j = 0; j < state.posts.length; j++) { if (state.posts[j].id === cpid) { cTarget = state.posts[j]; break; } }
    if (!cTarget) { sendJSON(res, 400, { error: "帖子不存在" }); return; }
    if (!Array.isArray(cTarget.comments)) cTarget.comments = [];
    cTarget.comments.push({ phone: cphone, name: cname, text: ctext, at: Date.now() });
    persist();
    broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, comments: cTarget.comments });
    return;
  }
  // 浏览量+1
  if (urlPath === "/api/posts/view" && req.method === "POST") {
    const body = await readBody(req);
    var vpid = body.id || "";
    if (Array.isArray(state.posts)) {
      for (var k = 0; k < state.posts.length; k++) {
        if (state.posts[k].id === vpid) { state.posts[k].views = (state.posts[k].views || 0) + 1; break; }
      }
      persist();
    }
    sendJSON(res, 200, { ok: true });
    return;
  }
  // 帖子图片上传（multipart/form-data，字段 file）
  if (urlPath === "/api/upload-post-image" && req.method === "POST") {
    const boundary = (req.headers["content-type"] || "").match(/boundary=(.*)$/);
    if (!boundary) { sendJSON(res, 400, { error: "缺少 boundary" }); return; }
    const MAX_IMG = 5 * 1024 * 1024;
    let totalImg = 0, imgTooLarge = false;
    const imgChunks = [];
    req.on("data", function (b) { totalImg += b.length; if (totalImg > MAX_IMG) { imgTooLarge = true; return; } imgChunks.push(b); });
    req.on("end", function () {
      try {
        if (imgTooLarge) { sendJSON(res, 413, { error: "图片过大（超过 5MB），请压缩后重试" }); return; }
        const buf = Buffer.concat(imgChunks);
        const bnd = "--" + boundary[1];
        const parts = buf.toString("binary").split(bnd);
        let imgData = null, ext = ".jpg";
        for (const p of parts) {
          if (p.indexOf("Content-Disposition") < 0) continue;
          const m = p.match(/filename="([^"]+)"/);
          if (m && m[1]) {
            const fn = m[1].toLowerCase();
            if (/\.png$/.test(fn)) ext = ".png";
            else if (/\.gif$/.test(fn)) ext = ".gif";
            else if (/\.webp$/.test(fn)) ext = ".webp";
            else ext = ".jpg";
          }
          const headerEnd = p.indexOf("\r\n\r\n");
          if (headerEnd >= 0) {
            imgData = Buffer.from(p.substring(headerEnd + 4).replace(/\r\n$/, ""), "binary");
          }
        }
        if (!imgData || imgData.length === 0) { sendJSON(res, 400, { error: "未收到图片数据" }); return; }
        saveImage(imgData, ext, "post").then(function (url) {
          sendJSON(res, 200, { ok: true, url: url });
        }).catch(function (err) {
          sendJSON(res, 500, { error: "保存失败: " + err.message });
        });
      } catch (e) { sendJSON(res, 500, { error: "解析失败" }); }
    });
    return;
  }
  // ===== 公告 API =====
  // 获取公告
  if (urlPath === "/api/announcements" && req.method === "GET") {
    sendJSON(res, 200, { ok: true, announcements: Array.isArray(state.announcements) ? state.announcements : [] });
    return;
  }
  // 添加 / 编辑公告
  if (urlPath === "/api/announcements" && req.method === "POST") {
    const body = await readBody(req);
    var aTitle = (body.title || "").trim();
    var aContent = (body.content || "").trim();
    var aId = body.id || "";
    if (!aTitle && !aContent) { sendJSON(res, 400, { error: "标题和内容不能全为空" }); return; }
    if (!Array.isArray(state.announcements)) state.announcements = [];
    if (aId) {
      var updated = false;
      for (var ai = 0; ai < state.announcements.length; ai++) {
        if (state.announcements[ai].id === aId) {
          state.announcements[ai].title = aTitle;
          state.announcements[ai].content = aContent;
          state.announcements[ai].updatedAt = Date.now();
          updated = true; break;
        }
      }
      if (!updated) { sendJSON(res, 400, { error: "公告不存在" }); return; }
    } else {
      state.announcements.unshift({
        id: "a" + Date.now() + Math.random().toString(36).slice(2, 6),
        title: aTitle,
        content: aContent,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      if (state.announcements.length > 20) state.announcements = state.announcements.slice(0, 20);
    }
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, announcements: state.announcements });
    return;
  }
  // 删除公告
  if (urlPath === "/api/announcements/delete" && req.method === "POST") {
    const body = await readBody(req);
    var dId = body.id || "";
    if (!dId) { sendJSON(res, 400, { error: "缺少 id" }); return; }
    if (!Array.isArray(state.announcements)) state.announcements = [];
    state.announcements = state.announcements.filter(function (a) { return a.id !== dId; });
    persist(); broadcast({ type: "sync", state: state });
    sendJSON(res, 200, { ok: true, announcements: state.announcements });
    return;
  }
  // ===== 拦截词管理 API =====
  // 获取拦截词列表
  if (urlPath === "/api/blocked-words" && req.method === "GET") {
    sendJSON(res, 200, { ok: true, words: Array.isArray(state.blockedWords) ? state.blockedWords : [] });
    return;
  }
  // 添加拦截词（支持单个或批量）
  if (urlPath === "/api/blocked-words" && req.method === "POST") {
    const body = await readBody(req);
    var addWords = Array.isArray(body.words) ? body.words : (body.word ? [body.word] : []);
    if (!addWords.length) { sendJSON(res, 400, { error: "缺少词汇" }); return; }
    if (!Array.isArray(state.blockedWords)) state.blockedWords = [];
    var added = 0;
    addWords.forEach(function (w) {
      var s = String(w || "").trim();
      if (s && state.blockedWords.indexOf(s) < 0) { state.blockedWords.push(s); added++; }
    });
    persist();
    sendJSON(res, 200, { ok: true, words: state.blockedWords, added: added });
    return;
  }
  // 删除拦截词
  if (urlPath === "/api/blocked-words/delete" && req.method === "POST") {
    const body = await readBody(req);
    var rmWord = String(body.word || "").trim();
    if (!rmWord) { sendJSON(res, 400, { error: "缺少词汇" }); return; }
    if (!Array.isArray(state.blockedWords)) state.blockedWords = [];
    state.blockedWords = state.blockedWords.filter(function (w) { return w !== rmWord; });
    persist();
    sendJSON(res, 200, { ok: true, words: state.blockedWords });
    return;
  }
  // 批量设置拦截词（覆盖）
  if (urlPath === "/api/blocked-words/replace" && req.method === "POST") {
    const body = await readBody(req);
    var newWords = Array.isArray(body.words) ? body.words.filter(function (w) { return String(w || "").trim(); }) : [];
    state.blockedWords = newWords;
    persist();
    sendJSON(res, 200, { ok: true, words: state.blockedWords });
    return;
  }
  serveStatic(req, res);
});
// 自动叫号 + 打烊清空 定时检查（每 30 秒）
function autoCallAndClosing() {
  if (!state) return;
  var changed = false;
  // 自动叫号
  if (state.autoCall && state.autoCall.enabled && state.machines) {
    var dur = (state.autoCall.duration || 8) * 60000;
    state.machines.forEach(function (mc) {
      var m = mc.id;
      var cur = state.current[m];
      var ct = state.callTime && state.callTime[m];
      if (cur && ct && (Date.now() - ct) >= dur) {
        // 超时自动叫下一位
        var q = state.queues[m] || [];
        var next = q.length > 0 ? q[0] : null;
        state.current[m] = next;
        state.callTime[m] = next ? Date.now() : 0;
        if (next && q.indexOf(next) >= 0) q.splice(0, 1);
        if (next) {
          var meta = state.numberMeta && state.numberMeta[m] && state.numberMeta[m][next];
          var callName = "", callVip = false, callMember = false, callAvatar = null;
          if (meta && meta.member && meta.phone) {
            callMember = true; callAvatar = meta.avatar || null;
            callName = meta.name || memberName(meta.phone) || "";
            var mb = addMemberVisit(meta.phone);
            if (mb) { callVip = (mb.visits || 0) >= VIP_THRESHOLD; meta.vip = callVip; meta.visits = mb.visits; if (mb.name) { meta.name = mb.name; callName = mb.name; } }
          }
          if (!Array.isArray(state.calledHistory)) state.calledHistory = [];
          state.calledHistory.push({ machine: m, number: next, name: callName, member: callMember, vip: callVip, avatar: callAvatar, time: Date.now() });
          if (state.calledHistory.length > 5) state.calledHistory = state.calledHistory.slice(-5);
          broadcast({ type: "call", machine: m, number: next, name: callName, vip: callVip, member: callMember, avatar: callAvatar });
        }
        changed = true;
      }
    });
  }
  // 打烊自动清空（按本地时间 HH:MM）
  if (state.closingTime) {
    var now = new Date();
    var hm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    if (hm === state.closingTime) {
      var lastClose = state._lastCloseDate || "";
      var today = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
      if (lastClose !== today) {
        // 清空所有队列与叫号
        if (state.machines) state.machines.forEach(function (mc) {
          var m = mc.id;
          state.queues[m] = [];
          state.current[m] = null;
          state.callTime[m] = 0;
          if (state.numberMeta) state.numberMeta[m] = {};
          if (state.enqueuedAt) state.enqueuedAt[m] = {};
        });
        state.calledHistory = [];
        state._lastCloseDate = today;
        changed = true;
        console.log("[" + new Date().toLocaleString() + "] 已到打烊时间，自动清空队列");
      }
    }
  }
  if (changed) { persist(); broadcast({ type: "sync", state: state }); }
}
setInterval(autoCallAndClosing, 30000);
// 云模式先从 DB 加载 state，再启动服务
loadStateFromDB().then(function () {
server.listen(PORT, "0.0.0.0", function () {
  console.log("========================================");
  console.log("  排队大屏服务已启动（含扫码取号）");
  console.log("========================================");
  console.log("  控制台（本机）： http://localhost:" + PORT + "/console.html");
  const ips = lanIPs();
  if (ips.length) { ips.forEach(function (i) { console.log("  大屏/取号（其他电脑/手机）：http://" + i.address + ":" + PORT + "/display.html   (" + i.name + ")"); }); }
  else { console.log("  （未检测到局域网 IP）"); }
  console.log("----------------------------------------");
  console.log("  扫码号前缀：" + SCAN_PREFIX + "（如 " + SCAN_PREFIX + "001）");
  console.log("  VIP 阈值：" + VIP_THRESHOLD + " 次");
  console.log("  机台数量：" + (state.machines ? state.machines.length : 0));
  console.log("  按 Ctrl+C 停止服务");
  console.log("========================================");
});
});
