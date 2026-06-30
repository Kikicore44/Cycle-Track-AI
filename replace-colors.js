import fs from 'fs';
import path from 'path';

const files = ['src/App.tsx', 'src/CalendarView.tsx', 'src/ChatView.tsx'];

const replacements = {
  '#c24a72': 'var(--color-primary)',
  '#eddff5': 'var(--color-primary-light)',
  '#903b5c': 'var(--color-primary-dark)',
  '#a83d60': 'var(--color-primary-hover)',
  '#d8c5e3': 'var(--color-primary-light-border)',
  '#8a6b96': 'var(--color-secondary)',
  '#6a3b79': 'var(--color-secondary-dark)',
  '#fdf6f0': 'var(--color-bg-app)'
};

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  for (const [hex, cssVar] of Object.entries(replacements)) {
    content = content.split(hex).join(cssVar);
  }
  
  fs.writeFileSync(filePath, content);
});

console.log('Replaced colors successfully.');
