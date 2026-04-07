// ============================================================
//  Google Apps Script — 苦因诊断测验 · Google Sheet 记录器
//  每位作答者占一行：时间戳 | 姓名 | 邮箱 | 总分 | 百分比
//  | 各部分分数 | Q1选项 … Q50选项
// ============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── 1. 取得 Sheet（第一个工作表）──
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
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

      // 冻结标题行
      sheet.setFrozenRows(1);

      // 加粗标题行
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

    // 追加 50 个答案字母（A/B/C/D）
    var answers = data.answers || [];
    for (var i = 0; i < 50; i++) {
      row.push(answers[i] || '');
    }

    sheet.appendRow(row);

    // ── 4. 返回成功 ──
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 测试用（在 Apps Script 编辑器中手动执行）──
function testDoPost() {
  var mockData = {
    name: '测试用户',
    email: 'test@example.com',
    totalScore: '42/50',
    percentage: '84%',
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
              'A','C','C','A','D','B','B','C','A','D']
  };

  var e = { postData: { contents: JSON.stringify(mockData) } };
  Logger.log(doPost(e).getContent());
}
