/* Сборка однофайлового снимка: вшивает config.js, engine.js, xlsxlite.js и ui.js в index.html.
   Запуск: node build_single.js <путь-выходного-файла>
   Шрифты остаются ссылками на Google Fonts — без сети подменятся системными. */
var fs = require('fs'), path = require('path');
var dir = __dirname;
var out = process.argv[2];
if (!out) { console.error('не указан путь выходного файла'); process.exit(1); }

var html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
var FILES = ['config.js', 'engine.js', 'xlsxlite.js', 'ui.js'];
FILES.forEach(function (f) {
  var re = new RegExp('<script src="' + f.replace('.', '\\.') + '(\\?v=\\d+)?"></script>');
  if (!re.test(html)) { console.error('не найдена ссылка на ' + f); process.exit(1); }
  var code = fs.readFileSync(path.join(dir, f), 'utf8');
  /* закрывающий тег внутри строки сломал бы разметку — экранируем */
  code = code.replace(/<\/script>/gi, '<\\/script>');
  html = html.replace(re, '<script>\n/* ==== ' + f + ' ==== */\n' + code + '\n</script>');
});
if (/<script src=/.test(html)) { console.error('остались внешние скрипты'); process.exit(1); }
if (html.length < 100000) { console.error('снимок подозрительно мал: ' + html.length + ' байт'); process.exit(1); }
fs.writeFileSync(out, html);
console.log('снимок собран: ' + out + ', ' + (html.length / 1024).toFixed(0) + ' КБ');
