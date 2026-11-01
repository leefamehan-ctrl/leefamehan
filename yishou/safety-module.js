/* 异兽秘境 · 学生输入安全模块（Safety Module）完整源代码
   这份文件与 HTML 里的安全模块完全相同，方便老师或技术人员单独检视、更新。
   使用方式：HTML 已内置，不需要另外加载这个文件。
   依赖 HTML 中的：LS、Cloud、Store、curGroup、openModal、T、esc、toast、CONFIG、GZ、fmtTime。 */
/* ================================================================
   学生输入安全模块（Safety Module）
   参考新加坡教育部 Cyber Wellness、Student Well-being、Responsible
   Use of Technology、Student Safeguarding 原则设计。
   ----------------------------------------------------------------
   · 所有开放式输入（线索表、研究所表格）都经过 validateStudentInput()
   · 三级处理：1 安全　2 不适当（请学生改写）　3 需要关注（关怀提示 + 老师查看）
   · 支持简体中文、繁体中文、英文及中英混合；结合上下文判断，
     文学分析、故事、神话中客观提到的敏感词不会单凭一个词就判定违规
   · 学生内容一律以文字显示（esc / textContent），不会当作网页代码执行
   · 不把学生内容写入浏览器控制台、网址或任何第三方分析工具
   · 这是浏览器端的初步筛查，不能取代老师的专业判断，也不能取代学校
     批准的伺服器端审核；详见文件最后的「限制说明」
   ================================================================ */
const Safety = (() => {
  const VERSION = "1.0";
  /* ---------- 老师可调整的设定（预设值） ---------- */
  const DEFAULTS = {
    strict: false,          // 严格模式：连较轻微的不礼貌字眼（笨蛋、stupid…）也会请学生改写
    blockWords: [],         // 老师自订：不适合课堂的词语
    allowWords: [],         // 老师自订：允许的词语（例如本课需要讨论的词）；不会影响第三级关怀提示
    keepConcernText: true,  // 第三级内容：是否保存原文给老师查看（只在教师端显示）
    contact: "请找班主任、华文老师或学校辅导员（School Counsellor）谈一谈。",
    helpline: "新加坡援人协会 SOS 24 小时热线：1767"
  };
  const LIMITS = { name: 20, short: 80, clue: 300, long: 600 };
  let FAIL = false;   // 测试用：模拟检测失效
  let cfg = { ...DEFAULTS };
  const loadLocal = () => { try { const v = JSON.parse(LS.get("safety", "{}")); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
  const merge = o => { const n = { ...DEFAULTS, ...(o || {}) };
    n.blockWords = (Array.isArray(n.blockWords) ? n.blockWords : String(n.blockWords || "").split(/[\n,，、]/)).map(x => String(x).trim()).filter(Boolean).slice(0, 200);
    n.allowWords = (Array.isArray(n.allowWords) ? n.allowWords : String(n.allowWords || "").split(/[\n,，、]/)).map(x => String(x).trim()).filter(Boolean).slice(0, 200);
    n.strict = !!n.strict; n.keepConcernText = n.keepConcernText !== false;
    n.contact = String(n.contact || DEFAULTS.contact).slice(0, 200); n.helpline = String(n.helpline == null ? DEFAULTS.helpline : n.helpline).slice(0, 200);
    return n; };
  cfg = merge(loadLocal());

  /* ---------- 文字正规化：全形→半形、繁→简、去掉零宽字元与分隔符号、还原 leet 写法 ---------- */
  const T2S = { "殺": "杀", "傷": "伤", "槍": "枪", "彈": "弹", "藥": "药", "醜": "丑", "滾": "滚", "媽": "妈", "幹": "干", "賤": "贱", "體": "体", "頭": "头", "腦": "脑",
    "廢": "废", "豬": "猪", "種": "种", "歧": "歧", "視": "视", "輕": "轻", "樓": "楼", "結": "结", "東": "东", "沒": "没", "義": "义", "學": "学", "擊": "击", "竊": "窃",
    "搶": "抢", "愛": "爱", "裸": "裸", "號": "号", "碼": "码", "電": "电", "話": "话", "證": "证", "傻": "傻", "筆": "笔", "們": "们", "這": "这", "個": "个", "麼": "么",
    "說": "说", "讓": "让", "對": "对", "會": "会", "為": "为", "們": "们", "還": "还", "無": "无", "聊": "聊", "掉": "掉", "罵": "骂", "欺": "欺", "負": "负", "霸": "霸",
    "淩": "凌", "凌": "凌", "脅": "胁", "跟": "跟", "蹤": "踪", "侵": "侵", "親": "亲", "爺": "爷", "繼": "继", "舅": "舅", "叔": "叔", "師": "师", "課": "课", "室": "室",
    "燒": "烧", "毀": "毁", "滅": "灭", "毒": "毒", "麻": "麻", "煙": "烟", "賭": "赌", "博": "博", "強": "强", "姦": "奸", "雞": "鸡", "陰": "阴", "莖": "茎", "道": "道",
    "黃": "黄", "片": "片", "約": "约", "炮": "炮", "開": "开", "房": "房", "鬼": "鬼", "佬": "佬", "雜": "杂", "殘": "残", "猴": "猴", "臉": "脸", "蠢": "蠢", "貨": "货",
    "癡": "痴", "痴": "痴", "障": "障", "畜": "畜", "渣": "渣", "圾": "圾", "厭": "厌", "閉": "闭", "嘴": "嘴", "胖": "胖", "願": "愿", "絕": "绝", "望": "望", "消": "消",
    "失": "失", "見": "见", "決": "决", "準": "准", "備": "备", "腕": "腕", "割": "割", "劃": "划", "殘": "残", "吞": "吞", "眠": "眠", "瓶": "瓶", "跳": "跳", "盡": "尽",
    "麼": "么", "著": "着", "應": "应", "該": "该", "當": "当", "時": "时", "後": "后", "裡": "里", "裏": "里", "從": "从", "來": "来", "過": "过", "邊": "边", "長": "长",
    "門": "门", "間": "间", "問": "问", "題": "题", "給": "给", "經": "经", "常": "常", "總": "总", "每": "每", "虐": "虐", "待": "待", "揍": "揍", "踢": "踢", "摸": "摸",
    "密": "密", "碼": "码", "家": "家", "住": "住", "址": "址", "郵": "邮", "電": "电", "腦": "脑", "製": "制", "造": "造", "藥": "药", "爆": "爆", "炸": "炸", "帶": "带",
    "刀": "刀", "拿": "拿", "班": "班", "級": "级", "灣": "湾", "國": "国", "滾": "滚", "蛋": "蛋", "馬": "马", "尼": "尼", "瑪": "玛", "婊": "婊", "屌": "屌", "肏": "操" };
  const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };
  function normalize(raw) {
    let s = String(raw == null ? "" : raw);
    try { s = s.normalize("NFKC"); } catch (e) { /* 旧浏览器 */ }
    s = s.replace(/[​-‏⁠﻿­]/g, "").toLowerCase();
    s = Array.from(s, ch => T2S[ch] || ch).join("");
    const spaced = s.replace(/\s+/g, " ").trim();
    // 英文：夹在字母之间的数字 / 符号还原为字母（f4ck → fack、sh1t → shit）
    const en = spaced.replace(/[a-z0-9@$!*]+/g, w => /[a-z]/.test(w) && /[0-9@$!]/.test(w) ? Array.from(w, c => LEET[c] || c).join("") : w)
      .replace(/\bf[*#@u._-]{1,3}c?k/g, "fuck").replace(/\bsh[*!1i]t\b/g, "shit").replace(/\bb[*!1i]tch/g, "bitch");
    // 去掉中文字之间、字母之间的分隔符号（自 杀、自*杀、s.u.i.c.i.d.e）
    const compact = en.replace(/[\s\p{P}\p{S}_]+/gu, "");
    return { raw: s, spaced, en, compact };
  }

  /* ---------- 词库（简体中文写法；繁体会先转成简体） ---------- */
  const R = (src, f = "") => new RegExp(src, f);
  const FIRST = /我|自己|本人|(^|[^a-z])(i|i'm|im|me|my|myself)([^a-z]|$)/;
  const ACADEMIC = /课文|文章|小说|故事|作者|人物|角色|主人公|主角|情节|描写|象征|比喻|诗|作品|文学|神话|传说|历史|新闻|讨论|分析|主题|反映|批判|警示|这篇|篇章|剧情|电影|戏剧|寓言|(^|[^a-z])(character|story|novel|poem|author|protagonist|plot|theme|symboli[sz]|text|passage|history|myth|legend|news|discuss|analy[sz]|film|movie|fable)/;

  // 第三级：伤害自己（明确的第一人称意图）
  const SELF_STRONG_ZH = [
    R("我(真的|好|很|就|都|也|还|一直|有时|常常)?(好|很)?(想|要|打算|准备|决定|会)(去)?(死|自杀|轻生|跳楼|割腕|自残|结束(自己的?|我的)?生命|了结(自己|我自己)|伤害自己)"),
    R("(不想|不要|不愿意?|没有勇气)(再)?(活|活下去|活着)"), R("活(着)?(不下去|没(有)?(意思|意义|希望))"), R("活着(好|很|真)?累"),
    R("(我)?死(了|掉)?(就)?算了"), R("不如(去)?死(了|掉)?"), R("(我|自己)(死了|消失了?|不在了?)(就|会|最|大家)(好|算了|比较好|开心|轻松)"),
    R("(割|划|刮)(伤)?(自己|手腕|我的手)"), R("伤害(我)?自己"), R("自残"), R("(吞|吃)(了)?(很多|一堆|整瓶|一整瓶)(安眠药|药|药片)"),
  ];
  const SELF_SOFT_ZH = [R("(我)?(好|很|真)?想消失"), R("没有人(会)?(在乎|关心|需要|喜欢)我"), R("我是(多余|没用)的"), R("(世界|大家)没有我(会)?更好")];
  const SELF_STRONG_EN = [
    R("\\b(i|i'?m|im|i am)\\b.{0,25}\\b(want|wanna|going|gonna|plan|planning|will|might|should)\\b.{0,12}\\b(to )?(die|kill myself|end (it all|my life)|hurt myself|cut myself|disappear forever)\\b"),
    R("\\bkill(ing)? my ?self\\b"), R("\\bend(ing)? my (own )?life\\b"), R("\\b(hurt|cut|harm)(ing)? my ?self\\b"), R("\\b(don'?t|do not) want to (live|be alive|exist)\\b"),
    R("\\bno reason to (live|go on)\\b"), R("\\b(i'?d|i would) be better off dead\\b"), R("\\bwish i (was|were) dead\\b"), R("\\bkms\\b"),
  ];
  const SELF_SOFT_EN = [R("\\b(i )?want to disappear\\b"), R("\\bnobody (cares|would care|loves|needs) (about )?me\\b"), R("\\bi'?m (so )?(worthless|useless|a burden)\\b")];
  const SELF_MENTION = R("自杀|轻生|跳楼|割腕|自残|自尽|(^|[^a-z])(suicid(e|al)|self[- ]?harm)([^a-z]|$)");
  const SELF_MENTION_C = R("自杀|轻生|割腕|自残|suicide|selfharm");

  // 第三级：威胁伤害他人
  const THREAT_ZH = [
    R("(我|我们)(真的|一定)?(要|会|想|准备|打算|一定要?|迟早)(去)?(杀(死|掉|了)?|砍(死|伤)?|捅(死|伤)?|打死|弄死|炸(掉|了|死)?|毒死|枪杀|烧死)(你|你们|他|她|他们|她们|老师|同学|全班|大家|所有人|学校|班上|[\\u4e00-\\u9fa5]{1,3}(老师|同学))"),
    R("(带|拿)(刀|枪|炸弹|武器|汽油)(去|到|来)(学校|班上|课室|教室)"), R("(炸|烧|血洗)(掉|毁)?(学校|课室|教室|班级|班上)"), R("杀(光|死)(全班|所有人|大家|同学)"),
  ];
  const THREAT_EN = [
    R("\\b(i|i'?m|im|i am|we|we'?re)\\b.{0,15}\\b(will|gonna|going to|want to|wanna|plan to|about to)\\b.{0,10}\\b(kill|shoot|stab|bomb|murder|beat up|hurt)\\b.{0,12}\\b(you|him|her|them|everyone|everybody|teacher|class|school|people)\\b"),
    R("\\b(bring|bringing|take|taking)\\b.{0,10}\\b(a )?(gun|knife|bomb|weapon)\\b.{0,15}\\bschool\\b"), R("\\bshoot up (the |my |our )?school\\b"), R("\\bbomb (the |my |our )?school\\b"),
  ];
  // 第三级：透露受到伤害（虐待、霸凌、侵犯）
  const ABUSE_ZH = [
    R("(爸爸|妈妈|爸|妈|父亲|母亲|继父|继母|家人|叔叔|舅舅|伯伯|哥哥|姐姐|爷爷|外公|老师|教练|有人|他|她|他们)(常常|经常|一直|又|每天|总是|昨天|都)?(会)?(打|揍|踢|虐待|性侵|侵犯|乱摸|摸)我"),
    R("我(一直|常常|经常|每天|又|在学校|在家)?(被|遭到|受到)(人)?(打|揍|虐待|性侵|侵犯|欺负|霸凌|威胁|勒索|孤立|跟踪)"), R("有人(在)?(欺负|霸凌|威胁|跟踪|勒索)我"),
  ];
  const ABUSE_EN = [
    R("\\b(my (dad|mom|mum|father|mother|stepdad|stepmom|uncle|brother|sister|teacher|coach)|someone|somebody|he|she|they)\\b.{0,15}\\b(hits|hit|beats|beat|hurts|abuses|abused|touched|touches|threatens)\\b.{0,6}\\bme\\b"),
    R("\\bi('?m| am) (being |getting )?(bullied|abused|threatened|harassed)\\b"),
  ];

  // 第二级：霸凌 / 骚扰 / 辱骂（标准）
  const BULLY_ZH = R("傻逼|傻b|傻比|煞笔|沙比|草泥马|操你|干你娘|你妈(的|死|逼)|他妈的|尼玛|nmsl|cnm|tmd|贱人|婊子|贱货|(^|[你滚就快赶紧给])去死|滚(开|蛋)|给我滚|你滚|死胖子|丑八怪|智障|脑残|白痴|蠢货|蠢猪|狗东西|畜生|人渣|(你|他|她|你们)(这个|真是|是个?|就是个?)?(废物|垃圾)|屌|鸡巴");
  const BULLY_EN = R("\\b(f+u+c+k+\\w*|fck|fk|wtf|stfu|shit\\w*|bitch\\w*|bastards?|assholes?|dickheads?|cunts?|morons?|idiots?|retard(ed|s)?|losers?|kys|go die|kill yourself|nobody likes you|i hate you|you('?re| are) (so )?(ugly|fat|stupid|dumb|useless|worthless))\\b");
  const BULLY_C = R("fuck|bitch|cunt|傻逼|煞笔|草泥马|操你|干你娘|贱人|婊子");
  // 第二级（严格模式加入）：较轻微的不礼貌字眼
  const MILD_ZH = R("笨蛋|蠢|丑八|胖子|闭嘴|讨厌你|神经病|残废|杂种|妈的");
  const MILD_EN = R("\\b(stupid|dumb|ugly|shut up|damn|crap|hell|sucks?|weirdo|freak)\\b");
  // 第二级：仇恨 / 歧视
  const HATE_ZH = R("黑鬼|支那|阿三|鬼佬|番鬼|死基佬|死同性恋|娘炮|人妖|马来猴|吉宁仔|(所有|全部)的?(马来人|华人|印度人|穆斯林|基督徒|女生|男生)都(是|很)(笨|懒|坏|脏|蠢|垃圾)|滚回(你的?|你们的?)?(国家|老家)");
  const HATE_EN = R("\\b(nigg(er|a)s?|chinks?|pakis?|faggots?|fags?|trann(y|ies)|go back to (your|ur) (own )?country|all (malays|chinese|indians|muslims|christians|girls|boys) are (stupid|lazy|dirty|bad|trash))\\b");
  const HATE_C = R("nigger|nigga|faggot");
  // 第二级：露骨 / 不适合未成年人的内容（文学讨论中客观提到时不算）
  const SEX_ZH = R("色情|黄片|a片|做爱|性交|裸体|裸照|约炮|强奸|鸡巴|阴茎|阴道|奶子|口交|自慰|开房|av女优");
  const SEX_EN = R("\\b(porn\\w*|sex|sexy|nudes?|naked|boobs?|tits|penis|vagina|dick pic|horny|rap(e|ed|ing)|masturbat\\w*|blowjob|xxx|onlyfans)\\b");
  const SEX_C = R("porn|blowjob|做爱|性交|黄片");
  // 第二级：危险或违法行为
  const DANGER_ZH = R("吸毒|毒品|大麻|冰毒|海洛因|摇头丸|k粉|(自制|做|制造|制作)(炸弹|炸药|枪)|炸药(怎么|的做法|配方)|偷东西|入店行窃|抢劫|放火烧|电子烟|抽烟|喝醉|赌博|酒驾");
  const DANGER_EN = R("\\b(cocaine|heroin|meth|weed|marijuana|ecstasy|lsd|vape|vaping|shoplift\\w*|get(ting)? drunk|gambling|how to (make|build) a (bomb|gun))\\b");
  // 第二级（严格模式）：血腥暴力描写
  const GORE = R("血腥|肢解|斩首|砍头|开膛|血肉模糊|爆头|(^|[^a-z])(gore|decapitat\\w*|dismember\\w*)");
  // 敏感个人资料（电话、身份证、电邮、住址、密码）
  const PII = [
    ["电话号码", R("(^|[^\\d])(\\+?65[\\s-]?)?[689]\\d{3}[\\s-]?\\d{4}([^\\d]|$)")],
    ["身份证号码", R("(^|[^a-z0-9])[stfgm]\\d{7}[a-z]([^a-z0-9]|$)")],
    ["电邮", R("[\\w.+-]+@[\\w-]+\\.[\\w.-]+")],
    ["住址", R("(^|[^a-z])(blk|block)\\s*\\d+|#\\d{1,2}-\\d{1,4}|singapore\\s*\\d{6}|新加坡\\s*\\d{6}|(我家|我住)(住)?在.{0,8}(\\d+|座|号|路|街|巷)")],
    ["密码", R("(密码|password|passcode)\\s*(是|:|：|=|is)")],
  ];

  const hit = (list, s) => list.some(r => r.test(s));
  const removeAllowed = s => cfg.allowWords.reduce((t, w) => w ? t.split(normalize(w).raw).join(" ") : t, s);

  /* ---------- 主检测：回传 { level, category, soft, message, text } ---------- */
  function classify(text) {
    const N = normalize(text), s = N.en, c = N.compact;
    if (!N.spaced) return { level: 1, category: "empty" };
    // —— 第三级（永远开启，老师的「允许词语」不会关掉它）——
    if (hit(THREAT_ZH, c) || hit(THREAT_EN, s)) return { level: 3, category: "threat" };
    if (hit(ABUSE_ZH, c) || hit(ABUSE_EN, s)) return { level: 3, category: "harmed" };
    if (hit(SELF_STRONG_ZH, c) || hit(SELF_STRONG_EN, s)) return { level: 3, category: "selfharm" };
    const academic = ACADEMIC.test(s) || ACADEMIC.test(c);
    if (SELF_MENTION.test(s) || SELF_MENTION_C.test(c)) {
      if (academic && !/我(想|要|会|打算|准备)|(^|[^a-z])(i|i'?m) (want|wanna|will|plan)/.test(s)) { /* 文学分析中的客观提及 → 安全 */ }
      else return { level: 3, category: "selfharm", soft: !FIRST.test(s) };
    }
    if (hit(SELF_SOFT_ZH, c) || hit(SELF_SOFT_EN, s)) return { level: 3, category: "distress", soft: true };
    // —— 个人资料 ——
    for (const [name, r] of PII) if (r.test(N.spaced)) return { level: 2, category: "privacy", detail: name };
    // —— 第二级 ——
    const s2 = removeAllowed(s), c2 = normalize(s2).compact;
    if (HATE_ZH.test(c2) || HATE_EN.test(s2) || HATE_C.test(c2)) return { level: 2, category: "hate" };
    if (BULLY_ZH.test(c2) || BULLY_EN.test(s2) || BULLY_C.test(c2)) return { level: 2, category: "bullying" };
    if ((SEX_ZH.test(c2) || SEX_EN.test(s2) || SEX_C.test(c2)) && !academic) return { level: 2, category: "sexual" };
    if ((DANGER_ZH.test(c2) || DANGER_EN.test(s2)) && !academic) return { level: 2, category: "danger" };
    if (cfg.blockWords.some(w => { const n = normalize(w); return n.compact && c2.includes(n.compact); })) return { level: 2, category: "custom" };
    if (cfg.strict) {
      if (MILD_ZH.test(c2) || MILD_EN.test(s2)) return { level: 2, category: "bullying", mild: true };
      if (GORE.test(c2) && !academic) return { level: 2, category: "graphic" };
    }
    return { level: 1, category: "ok" };
  }

  /* ---------- 清理：移除网页代码、控制字元，限制长度 ---------- */
  function sanitize(text, max) {
    let s = String(text == null ? "" : text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    s = s.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "").replace(/<\/?[a-z!][^>]*>/gi, "").replace(/javascript\s*:/gi, "");
    const over = max && s.length > max; if (over) s = s.slice(0, max);
    return { text: s, over };
  }

  const MSG = {
    2: "你的回答可能包含不适当的用语。请尝试使用尊重、友善和适合课堂的语言重新表达。",
    privacy: "为了保护你的隐私，请不要在答案里写电话号码、身份证号码、住址、电邮或密码。请删掉这些资料后再继续。",
    3: "谢谢你愿意表达自己的想法。如果这些内容与你目前的感受或安全有关，请尽快告诉老师、学校辅导员或你信任的成年人。你不需要独自处理这些事情。",
    long: "这一栏的字数太多了，超过的部分不会保存。",
    error: "系统暂时无法检查这段文字，已先保存，并会请老师留意。"
  };
  const CAT_NAME = { threat: "可能伤害他人", harmed: "可能受到伤害", selfharm: "可能伤害自己", distress: "情绪困扰", privacy: "个人资料", hate: "仇恨 / 歧视", bullying: "霸凌 / 辱骂", sexual: "不适合未成年人", danger: "危险 / 违法行为", custom: "老师自订词语", graphic: "血腥描写", error: "未能检查" };

  /* ---------- 对外：统一检测流程 ---------- */
  function validateStudentInput(text, ctx = {}) {
    const max = ctx.max || LIMITS[ctx.kind] || LIMITS.long;
    const sz = sanitize(text, max);
    let r;
    try { if (FAIL) throw new Error("simulated"); r = classify(sz.text); }
    catch (e) { r = { level: 1, category: "error", review: true }; }   // 检测失败：不阻挡学习，但交给老师人工查看
    const message = r.level === 3 ? MSG[3] : r.level === 2 ? (r.category === "privacy" ? MSG.privacy : MSG[2]) : r.review ? MSG.error : sz.over ? MSG.long : "";
    return { ok: r.level === 1, level: r.level, category: r.category, soft: !!r.soft, review: !!r.review, text: sz.text, over: sz.over, message };
  }

  /* ---------- 记录第三级 / 无法检查的情况，供老师在教师端查看 ---------- */
  function record(field, res, original) {
    const g = typeof curGroup === "function" ? curGroup() : null; if (!g) return false;
    g.safety = Array.isArray(g.safety) ? g.safety : [];
    const last = g.safety[g.safety.length - 1];
    if (last && last.field === field && last.cat === res.category && Date.now() - last.t < 120000) { if (cfg.keepConcernText) last.text = String(original).slice(0, 300); last.t = Date.now(); }
    else g.safety.push({ t: Date.now(), field, level: res.review ? 0 : res.level, cat: res.category, soft: res.soft, text: cfg.keepConcernText ? String(original).slice(0, 300) : "" });
    if (g.safety.length > 40) g.safety = g.safety.slice(-40);
    Store.save(g); return true;
  }

  /* ---------- 学生端提示 ---------- */
  const careShown = {};
  function careModal(field) {
    if (careShown[field] && Date.now() - careShown[field] < 600000) return;
    careShown[field] = Date.now();
    openModal(`<div class="care"><h3>💛 ${T("谢谢你愿意说出来", false, true)}</h3>
      <p>${T(MSG[3])}</p>
      <p class="care-c">${esc(cfg.contact)}</p>${cfg.helpline ? `<p class="care-c">${esc(cfg.helpline)}</p>` : ""}
      <p class="care-s">${T("如果你现在有危险，请马上告诉身边的大人。")}</p>
      <div class="modal-actions"><button class="btn" data-close>${T("我明白了", false, true)}</button></div></div>`, { noClose: false });
  }
  function showInline(el, res) {
    let m = el.nextElementSibling && el.nextElementSibling.classList && el.nextElementSibling.classList.contains("safe-msg") ? el.nextElementSibling : null;
    if (!res || (!res.message)) { if (m) m.remove(); el.classList.remove("safe-warn", "safe-care"); el.removeAttribute("aria-invalid"); return; }
    if (!m) { m = document.createElement("div"); m.className = "safe-msg"; m.setAttribute("role", "status"); m.setAttribute("aria-live", "polite"); el.insertAdjacentElement("afterend", m); }
    m.className = "safe-msg " + (res.level === 3 ? "care" : res.level === 2 ? "warn" : "info");
    m.innerHTML = (res.level === 3 ? "💛 " : res.level === 2 ? "✎ " : "ℹ ") + T(res.message);
    el.classList.toggle("safe-warn", res.level === 2); el.classList.toggle("safe-care", res.level === 3);
    if (res.level >= 2) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
  }
  /* 接到输入框：安全的内容才交给 apply() 保存；不适当 / 需要关注的内容不会保存或公开显示 */
  function bind(el, o) {
    const max = o.max || LIMITS[o.kind] || LIMITS.long;
    el.setAttribute("maxlength", String(max));
    let t;
    const run = (final) => {
      const res = validateStudentInput(el.value, { kind: o.kind, max });
      el._safe = res;
      if (res.level === 1) { showInline(el, res.message ? res : null); o.apply(res.text); if (res.review) record(o.field, res, el.value); }
      else if (res.level === 2) { showInline(el, res); }
      else { showInline(el, res); if (final) { record(o.field, res, el.value); careModal(o.field); } }
      if (o.after) o.after(res);
      return res;
    };
    el.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => run(false), 450); });
    el.addEventListener("change", () => { clearTimeout(t); run(true); });
    el.addEventListener("blur", () => { clearTimeout(t); run(true); });
    el._safeRun = run;
  }
  /* 提交前：检查一个范围内所有接上的输入框，回传最严重的结果 */
  function checkAll(root) {
    let worst = null;
    root.querySelectorAll("input,textarea").forEach(el => { if (!el._safeRun) return; const r = el._safeRun(true); if (r.level > 1 && (!worst || r.level > worst.res.level)) worst = { el, res: r }; });
    if (worst) { worst.el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => worst.el.focus(), 300); }
    return worst;
  }

  /* ---------- 设定：老师的电脑 + 云端（让全班学生使用相同设定） ---------- */
  async function syncSettings() {
    if (!Cloud.on) return;
    try { const r = await fetch(Cloud.base() + "/settings.json"); if (r.ok) { const v = await r.json(); if (v && typeof v === "object") cfg = merge({ ...loadLocal(), ...v }); } } catch (e) { /* 离线时使用本机设定 */ }
  }
  async function saveSettings(o) {
    cfg = merge(o); LS.set("safety", JSON.stringify(cfg));
    if (Cloud.on) { try { const r = await fetch(Cloud.base() + "/settings.json", { method: "PUT", body: JSON.stringify(cfg) }); if (!r.ok) throw new Error("HTTP " + r.status); return "cloud"; } catch (e) { return "local-only"; } }
    return "local";
  }

  /* AI 安全指示：将来若加入 AI 回馈 / 对话 / 批改功能，必须把这段放进 System Prompt */
  const AI_SYSTEM_SAFETY = `You are an educational AI assistant supporting secondary school students in Singapore.
Prioritise student safety, well-being, age-appropriate communication, respectful language, and responsible digital citizenship.
Do not generate harmful instructions, threats, discriminatory abuse, sexually explicit content, or guidance that could endanger students.
When student input suggests a possible safety concern, respond calmly and supportively. Do not diagnose, shame, punish, or provide harmful details.
Encourage the student to seek assistance from a teacher, school counsellor, or trusted adult when appropriate.
Distinguish educational discussion, fictional narratives, and literary analysis from genuine safety concerns.
Do not treat a keyword match alone as proof of risk.
Follow the school's approved safeguarding and escalation procedures. Do not claim that a teacher has been notified unless notification has actually succeeded.
Protect student privacy and minimise the collection, retention, and disclosure of personal information.`;
  /* 给 AI 生图工具的安全要求（附在学生复制的生图指令后面） */
  const IMAGE_PROMPT_SAFETY = "安全要求：画面适合中学生观看，不要出现血腥、暴力伤害、恐怖、裸露或任何歧视性的内容。";

  return { VERSION, validateStudentInput, classify, normalize, sanitize, bind, checkAll, record, careModal, showInline, syncSettings, saveSettings,
    get cfg() { return cfg; }, _simulateFailure(v) { FAIL = !!v; }, DEFAULTS, LIMITS, CAT_NAME, MSG, AI_SYSTEM_SAFETY, IMAGE_PROMPT_SAFETY };
})();
const validateStudentInput = Safety.validateStudentInput;

/* ---------- 教师端：安全设定 ---------- */
const SafetyUI = {
  settings() {
    const c = Safety.cfg;
    const b = openModal(`<h3>🛡 学生输入安全设定</h3>
      <p class="muted" style="font-size:.88rem;margin:4px 0 10px">设定会储存在这台电脑；已设定云端时，也会同步给这个课堂码的所有学生。第三级「需要关注」的检测永远开启，不能关闭。</p>
      <label class="cs-l"><input type="checkbox" id="sfStrict" ${c.strict ? "checked" : ""}> 严格模式（连「笨蛋、闭嘴、stupid、shut up」等较轻微的字眼也请学生改写；也会挡下血腥描写）</label>
      <label class="cs-l"><input type="checkbox" id="sfKeep" ${c.keepConcernText ? "checked" : ""}> 第三级内容保存原文给老师查看（只显示在教师端；取消后只记录时间、栏位与类别）</label>
      <label class="cs-l">老师自订：不适合课堂的词语（每行一个）</label><textarea class="txt" id="sfBlock" rows="3"></textarea>
      <label class="cs-l">老师自订：允许的词语（每行一个，例如本课需要讨论的词；不会关闭第三级关怀提示）</label><textarea class="txt" id="sfAllow" rows="3"></textarea>
      <label class="cs-l">第三级提示中显示的校内联络方式</label><input class="txt" id="sfContact" maxlength="200">
      <label class="cs-l">额外求助资讯（可留空）</label><input class="txt" id="sfHelp" maxlength="200">
      <details style="margin-top:10px"><summary>AI 安全指示（将来加入 AI 功能时使用）</summary><textarea class="txt" readonly rows="8" style="font-size:.78rem;font-family:monospace">${esc(Safety.AI_SYSTEM_SAFETY)}</textarea></details>
      <p id="sfMsg" style="min-height:1.3em;font-size:.9rem;margin-top:6px"></p>
      <div class="modal-actions"><button class="btn ghost" style="color:var(--ink)" id="sfReset">恢复预设</button><button class="btn ghost" style="color:var(--ink)" data-close>取消</button><button class="btn" id="sfSave">储存设定</button></div>`, { wide: true });
    $("#sfBlock", b).value = c.blockWords.join("\n"); $("#sfAllow", b).value = c.allowWords.join("\n");
    $("#sfContact", b).value = c.contact; $("#sfHelp", b).value = c.helpline;
    $("#sfReset", b).onclick = () => { $("#sfStrict", b).checked = false; $("#sfKeep", b).checked = true; $("#sfBlock", b).value = ""; $("#sfAllow", b).value = "";
      $("#sfContact", b).value = Safety.DEFAULTS.contact; $("#sfHelp", b).value = Safety.DEFAULTS.helpline; };
    $("#sfSave", b).onclick = async () => {
      const r = await Safety.saveSettings({ strict: $("#sfStrict", b).checked, keepConcernText: $("#sfKeep", b).checked, blockWords: $("#sfBlock", b).value, allowWords: $("#sfAllow", b).value,
        contact: $("#sfContact", b).value.trim(), helpline: $("#sfHelp", b).value.trim() });
      toast(r === "cloud" ? "✓ 安全设定已储存，并同步给全班" : r === "local-only" ? "⚠ 已储存在这台电脑，但同步到云端失败" : "✓ 安全设定已储存（这台电脑）", r === "local-only");
      closeModal();
    };
  },
  /* 教师端总览：安全提醒清单 */
  panel(groups) {
    const rows = [];
    CONFIG.GROUPS.forEach(gid => { const g = groups[gid]; (g && Array.isArray(g.safety) ? g.safety : []).forEach((f, i) => rows.push({ gid, i, f })); });
    /* 教师端复查：把已保存的学生文字再检查一次（防止有人改动网页程序、绕过学生端检查） */
    this.rescan = {};
    CONFIG.GROUPS.forEach(gid => { const g = groups[gid]; if (!g) return;
      const texts = [];
      Object.entries(g.clues || {}).forEach(([a, o]) => Object.entries(o || {}).forEach(([k, v]) => texts.push(["clue", v])));
      const cr = g.creation || {};
      texts.push(["name", cr.name], ["reason", cr.reason], ["ability", cr.abilities && cr.abilities.text], ["world", cr.world && cr.world.text], ["symbol", cr.symbols && cr.symbols.text]);
      Object.values(cr.traits || {}).forEach(t => texts.push(["trait", t && t.text]));
      texts.forEach(([field, v]) => { if (!v || typeof v !== "string") return; const r = Safety.validateStudentInput(v, { max: 2000 });
        if (r.level > 1) { const key = gid + "|r" + Object.keys(this.rescan).length; this.rescan[key] = v; rows.push({ gid, i: key, f: { t: g.updatedAt, field, level: r.level, cat: r.category, soft: r.soft, text: v, rescan: true } }); } });
    });
    if (!rows.length) return `<div class="panel-dark t-sec safe-panel"><h3>🛡 学生安全提醒</h3><p class="muted">目前没有需要关注的内容。系统也会自动请学生改写不适当的用语（这些内容不会保存）。</p></div>`;
    rows.sort((a, b) => b.f.t - a.f.t);
    const FIELD = { name: "动物名称", reason: "设计理由", ability: "特殊能力", world: "生活环境", symbol: "象征意义", trait: "外形特点", clue: "线索整理表" };
    return `<div class="panel-dark t-sec safe-panel"><h3>🛡 学生安全提醒 <small class="muted">（${rows.length} 则，最新在上）</small></h3>
      <p class="muted" style="font-size:.85rem;margin-bottom:8px">这是电脑的初步筛查，可能误判。请老师亲自了解学生情况，并按照学校批准的辅导及通报程序处理；系统不会自动通知任何人。</p>
      <table class="t-table"><tr><th>时间</th><th>小组</th><th>栏位</th><th>类别</th><th>内容</th></tr>
      ${rows.slice(0, 30).map(r => `<tr><td>${fmtTime(r.f.t)}</td><td>${GZ(r.gid)}</td><td>${esc(FIELD[String(r.f.field).split(":")[0]] || r.f.field)}</td>
        <td><span class="pill ${r.f.level === 3 ? "err" : "ing"}">${r.f.level === 3 ? "需要关注" : r.f.level === 2 ? "不适当用语" : "人工查看"} · ${esc(Safety.CAT_NAME[r.f.cat] || r.f.cat)}${r.f.soft ? "（程度未明）" : ""}${r.f.rescan ? "（教师端复查发现）" : ""}</span></td>
        <td>${r.f.text ? `<button class="btn small ghost" data-sfshow="${String(r.i).includes("|") ? r.i : r.gid + "|" + r.i}">显示内容</button>` : '<span class="muted">未保存原文</span>'}</td></tr>`).join("")}</table></div>`;
  },
  bindPanel(m, groups) {
    $$("[data-sfshow]", m).forEach(b => b.onclick = () => { const key = b.dataset.sfshow, [gid, i] = key.split("|");
      const text = /^r\d+$/.test(i) ? (this.rescan || {})[key] : (groups[gid].safety[+i] || {}).text;
      const cell = document.createElement("div"); cell.className = "sf-text"; cell.textContent = text || ""; b.replaceWith(cell); });
  }
};
