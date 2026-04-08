// ============================================================
//  Google Apps Script — 苦因诊断测验 · Google Sheet 记录器
//  + 自动发送成绩单邮件给作答者
//  每位作答者占一行：时间戳 | 姓名 | 邮箱 | 总分 | 百分比
//  | 各部分分数 | Q1选项 … Q50选项
// ============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── 1. 取得 Sheet（第一个工作表）──
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];

    // ── 2. 如果是空表，写入表头 ──
    if (sheet.getLastRow() === 0) {
      var headers = [
        '提交时间', '姓名', '电子邮箱', '总分', '百分比',
        '第一部分（1-10）', '第二部分（11-20）',
        '第三部分（21-40）', '第四部分（41-50）'
      ];
      for (var q = 1; q <= 50; q++) {
        headers.push('Q' + q);
      }
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }

    // ── 3. 整理一行数据 ──
    var now = Utilities.formatDate(
      new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm:ss'
    );

    var secScores = data.sectionScores || {};
    var row = [
      now,
      data.name        || '',
      data.email       || '',
      data.totalScore  || '',
      data.percentage  || '',
      secScores['第一部分：苦因诊断与错觉拆解（题 1–10）'] || '',
      secScores['第二部分：生命能量与行为模式（题 11–20）'] || '',
      secScores['第三部分：缘起逻辑与实战观察（题 21–40）'] || '',
      secScores['第四部分：高级集成与终极修复（题 41–50）'] || ''
    ];

    // --- 修改部分：标注答对或答错 ---
    var details = data.questionDetails || []; 
    var optLetters = ['A', 'B', 'C', 'D'];

    for (var i = 0; i < 50; i++) {
      if (details[i]) {
        var d = details[i];
        var userLetter = optLetters[d.userAnswer] || '-';
        // 如果答对显示 [A] ✅，答错显示 [B] ❌
        var mark = d.isCorrect ? ' ✅' : ' ❌';
        row.push(userLetter + mark);
      } else {
        row.push(''); // 防止数据缺失
      }
    }
    // ----------------------------

    sheet.appendRow(row);

    // ── 4. 发送成绩单邮件 ──
    if (data.sendEmail && data.email && data.email.includes('@')) {
      try {
        sendResultEmail(data);
      } catch (mailErr) {
        Logger.log('邮件发送失败：' + mailErr.toString());
      }
    }

    // ── 5. 返回成功 ──
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
//  邮件发送函数
// ============================================================
function sendResultEmail(data) {
  var name         = data.name        || '作答者';
  var email        = data.email;
  var totalScore   = data.totalScore  || '';
  var percentage   = data.percentage  || '';
  var secScores    = data.sectionScores || {};
  var details      = data.questionDetails || [];   // [{num, q, options, userAnswer, correctAnswer, isCorrect, correct_exp, wrong_exp, section}, ...]

  var subject = '【快乐掉线？补丁在这】您的测验成绩单 — ' + totalScore + ' (' + percentage + ')';

  // ── 鼓励语 ──
  var pctNum = parseInt(percentage);
  var encouragement;
  if (pctNum >= 90)      encouragement = '非常出色！您对四圣谛、缘起与三法印的理解已相当深入，继续保持正念修行。';
  else if (pctNum >= 75) encouragement = '理解不错！有几个概念还可以再深入觉察，建议回顾解析，结合自身经验再反思。';
  else if (pctNum >= 60) encouragement = '有一定基础，但还有不少误解需要厘清。建议重新阅读解析，多从生活场景中观察。';
  else                   encouragement = '这些概念需要更多时间消化。不急，慢慢来——佛法不是靠「知道」，而是靠「觉察」。建议从缘起开始重新学习。';

  // ── 各部分分数表格 ──
  var sectionRows = '';
  var sectionOrder = [
    '第一部分：苦因诊断与错觉拆解（题 1–10）',
    '第二部分：生命能量与行为模式（题 11–20）',
    '第三部分：缘起逻辑与实战观察（题 21–40）',
    '第四部分：高级集成与终极修复（题 41–50）'
  ];
  var shortNames = ['第一部分（题 1–10）', '第二部分（题 11–20）', '第三部分（题 21–40）', '第四部分（题 41–50）'];
  for (var s = 0; s < sectionOrder.length; s++) {
    var sc = secScores[sectionOrder[s]] || '-';
    sectionRows += '<tr><td style="padding:8px 14px;border-bottom:1px solid #f0e8d8;color:#5c3d1e;">' + shortNames[s] + '</td>'
                 + '<td style="padding:8px 14px;border-bottom:1px solid #f0e8d8;text-align:center;font-weight:bold;color:#c0732a;">' + sc + '</td></tr>';
  }

  // ── 逐题明细 ──
  var questionRows = '';
  var currentSection = '';
  var optLetters = ['A', 'B', 'C', 'D'];

  for (var qi = 0; qi < details.length; qi++) {
    var d = details[qi];

    // 部分标题
    if (d.section && d.section !== currentSection) {
      currentSection = d.section;
      questionRows += '<tr><td colspan="2" style="background:#e8d9bf;padding:10px 14px;font-weight:bold;color:#5c3d1e;border-left:4px solid #c0732a;">' + currentSection + '</td></tr>';
    }

    // 结果标记
    var resultIcon  = d.isCorrect ? '✅' : '❌';
    var rowBg       = d.isCorrect ? '#f0faf0' : '#fff5f5';

    // 选项列表
    var optHtml = '';
    for (var oi = 0; oi < d.options.length; oi++) {
      var optStyle = 'padding:3px 0;font-size:13px;';
      var prefix   = optLetters[oi] + '. ';
      // 去掉题目中已有的 A. B. 前缀（options 里已含）
      var optText  = d.options[oi];
      if (oi === d.userAnswer && oi === d.correctAnswer) {
        optStyle += 'color:#2e7d32;font-weight:bold;';
        prefix = '✅ ';
      } else if (oi === d.userAnswer && oi !== d.correctAnswer) {
        optStyle += 'color:#c62828;font-weight:bold;text-decoration:line-through;';
        prefix = '❌ ';
      } else if (oi === d.correctAnswer) {
        optStyle += 'color:#2e7d32;';
        prefix = '☑ ';
      }
      optHtml += '<div style="' + optStyle + '">' + prefix + optText + '</div>';
    }

    // 解析文字
    var expText = d.isCorrect ? ('✅ 答对了！' + d.correct_exp) : ('解析：' + d.wrong_exp);
    var expColor = d.isCorrect ? '#1b5e20' : '#7f3b08';

    questionRows +=
      '<tr style="background:' + rowBg + ';">' +
      '<td style="padding:14px;vertical-align:top;width:28px;font-size:18px;">' + resultIcon + '</td>' +
      '<td style="padding:14px 14px 14px 4px;">' +
        '<div style="font-weight:bold;font-size:14px;color:#2c2416;margin-bottom:8px;">Q' + d.num + '. ' + d.q + '</div>' +
        '<div style="margin-bottom:10px;">' + optHtml + '</div>' +
        '<div style="background:#fdf6ec;border-left:3px solid ' + (d.isCorrect ? '#4caf50' : '#e57373') + ';padding:8px 12px;font-size:13px;color:' + expColor + ';border-radius:0 4px 4px 0;">' + expText + '</div>' +
      '</td>' +
      '</tr>';
  }

  // ── HTML 邮件正文 ──
  var htmlBody =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f0ea;font-family:\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">' +

    // Header
    '<div style="background:linear-gradient(135deg,#5c3d1e,#8b6340);color:#fdf6ec;text-align:center;padding:36px 20px 28px;">' +
      '<h1 style="margin:0 0 6px;font-size:22px;letter-spacing:2px;">快乐掉线？补丁在这</h1>' +
      '<p style="margin:0;font-size:14px;opacity:0.85;">系统升级测验 · 成绩单</p>' +
    '</div>' +

    // Score hero
    '<div style="background:white;max-width:680px;margin:0 auto;padding:28px 24px;">' +
      '<p style="font-size:15px;color:#5c3d1e;margin:0 0 4px;">亲爱的 <strong>' + name + '</strong>，</p>' +
      '<p style="font-size:14px;color:#7a6040;margin:0 0 20px;">感谢您完成本次测验。以下是您的完整成绩单。</p>' +

      '<div style="background:linear-gradient(135deg,#5c3d1e,#8b6340);border-radius:16px;padding:28px;text-align:center;color:#fdf6ec;margin-bottom:24px;">' +
        '<div style="font-size:13px;opacity:0.85;margin-bottom:6px;">您的得分</div>' +
        '<div style="font-size:52px;font-weight:bold;line-height:1;">' + totalScore + '</div>' +
        '<div style="font-size:24px;margin:6px 0;">' + percentage + '</div>' +
        '<div style="font-size:13px;line-height:1.7;opacity:0.9;margin-top:12px;background:rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;">' + encouragement + '</div>' +
      '</div>' +

      // Section scores table
      '<h2 style="font-size:15px;color:#5c3d1e;margin:0 0 10px;border-bottom:2px solid #e8d9bf;padding-bottom:6px;">各部分得分</h2>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:28px;">' + sectionRows + '</table>' +

      // Question details
      '<h2 style="font-size:15px;color:#5c3d1e;margin:0 0 10px;border-bottom:2px solid #e8d9bf;padding-bottom:6px;">逐题作答详情与解析</h2>' +
      '<table style="width:100%;border-collapse:collapse;">' + questionRows + '</table>' +

      // Footer
      '<div style="margin-top:32px;padding-top:18px;border-top:1px solid #e8d9bf;font-size:12px;color:#b0906a;text-align:center;">' +
        '此邮件由系统自动发送，请勿直接回复。<br>愿您在觉察中持续成长，离苦得乐。🙏' +
      '</div>' +
    '</div>' +

    '</body></html>';

  MailApp.sendEmail({
    to:       email,
    subject:  subject,
    htmlBody: htmlBody
  });

  Logger.log('成绩单邮件已发送至：' + email);
}


// ============================================================
//  测试用（在 Apps Script 编辑器中手动执行）
// ============================================================
function testDoPost() {
  var mockDetails = [];
  for (var i = 1; i <= 50; i++) {
    mockDetails.push({
      section: i === 1  ? '第一部分：苦因诊断与错觉拆解（题 1–10）'   :
               i === 11 ? '第二部分：生命能量与行为模式（题 11–20）'   :
               i === 21 ? '第三部分：缘起逻辑与实战观察（题 21–40）'   :
               i === 41 ? '第四部分：高级集成与终极修复（题 41–50）'   : null,
      num: i,
      q: '测试题目 ' + i,
      options: ['A. 选项一', 'B. 选项二', 'C. 选项三', 'D. 选项四'],
      userAnswer:    i % 2 === 0 ? 0 : 1,
      correctAnswer: 0,
      isCorrect:     i % 2 === 0,
      correct_exp: '正确解析内容。',
      wrong_exp:   '错误解析内容。'
    });
  }

  var mockData = {
    name: '测试用户',
    email: 'test@example.com',   // ← 改为您的真实邮箱以测试收信
    totalScore: '42/50',
    percentage: '84%',
    sendEmail: true,
    sectionScores: {
      '第一部分：苦因诊断与错觉拆解（题 1–10）': '8/10',
      '第二部分：生命能量与行为模式（题 11–20）': '9/10',
      '第三部分：缘起逻辑与实战观察（题 21–40）': '17/20',
      '第四部分：高级集成与终极修复（题 41–50）': '8/10'
    },
    answers: ['B','A','C','A','D','A','C','B','A','C',
              'A','D','B','A','C','D','A','C','A','D',
              'B','C','A','D','C','A','D','C','A','A',
              'B','D','A','C','A','B','D','A','C','C',
              'A','C','C','A','D','B','B','C','A','D'],
    questionDetails: mockDetails
  };

  var e = { postData: { contents: JSON.stringify(mockData) } };
  Logger.log(doPost(e).getContent());
}
