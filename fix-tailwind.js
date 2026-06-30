import fs from 'fs';
import path from 'path';

const files = ['src/App.tsx', 'src/CalendarView.tsx', 'src/ChatView.tsx'];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/\[var\(--color-([a-zA-Z0-9-]+)\)\]/g, '$1');
  
  fs.writeFileSync(filePath, content);
});

console.log('Fixed Tailwind classes.');
