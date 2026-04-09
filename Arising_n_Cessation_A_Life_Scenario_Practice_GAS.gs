function doPost(e) {
  try {
    // 1. 解析前端传来的 JSON 数据
    var data = JSON.parse(e.postData.contents);
    var email = data.email;
    var totalScore = data.totalScore;
    var sectionScores = data.sectionScores;
    var questionResults = data.questionResults || []; // 每题对错：✓ 或 ✗
    var emailHtmlBody = data.emailHtmlBody;

    // 2. 将成绩写入 Google Sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 如果第一行是空的，先写入表头
    if (sheet.getLastRow() === 0) {
      var headers = ["时间", "邮箱", "总分",
        "第一部分（1–10）", "第二部分（11–20）", "第三部分（21–28）",
        "第四部分（29–37）", "第五部分（38–40）"
      ];
      for (var q = 1; q <= 40; q++) {
        headers.push("Q" + q);
      }
      sheet.appendRow(headers);
    }

    // 构建数据行：基础列 + 每题对错
    var row = [
      new Date(), 
      email, 
      totalScore, 
      sectionScores["第一部分：缘起与因果（题 1–10）"] || "0/0",
      sectionScores["第二部分：苦的本质（题 11–20）"] || "0/0",
      sectionScores["第三部分：无常（题 21–28）"] || "0/0",
      sectionScores["第四部分：无我（题 29–37）"] || "0/0",
      sectionScores["第五部分：四圣谛综合（题 38–40）"] || "0/0"
    ];

    // 追加每题对错（Q1 至 Q40），✓ = 正确，✗ = 错误
    for (var i = 0; i < 40; i++) {
      row.push(questionResults[i] || "–");
    }

    sheet.appendRow(row);

    // 3. 发送邮件给用户
    var subject = "集与灭——生活场景测验 详细成绩与解析";
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: emailHtmlBody
    });

    // 返回成功状态给前端
    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
