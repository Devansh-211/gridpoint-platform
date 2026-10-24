import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

function getAllTsxFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        getAllTsxFiles(fullPath, fileList);
      }
    } else if (file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('Dead Control Scanner', () => {
  const srcDir = path.resolve(__dirname, '..');
  const tsxFiles = getAllTsxFiles(srcDir);

  it('scans all JSX files ensuring buttons have handlers, type="submit", asChild, or data-inert-reason', () => {
    const violations: { file: string; line: number; tag: string }[] = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );

      function visit(node: ts.Node, parent?: ts.Node) {
        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
          const opening = ts.isJsxElement(node) ? node.openingElement : node;
          const tagName = opening.tagName.getText(sourceFile);

          const attributes = opening.attributes.properties;
          let isButtonRole = false;
          let hasOnClick = false;
          let hasSubmit = false;
          let hasAsChild = false;
          let hasInertReason = false;

          for (const attr of attributes) {
            if (ts.isJsxAttribute(attr)) {
              const name = attr.name.getText(sourceFile);
              if (name === 'onClick') hasOnClick = true;
              if (name === 'asChild') hasAsChild = true;
              if (name === 'data-inert-reason') hasInertReason = true;
              if (name === 'role') {
                const init = attr.initializer?.getText(sourceFile);
                if (init?.includes('button')) isButtonRole = true;
              }
              if (name === 'type') {
                const init = attr.initializer?.getText(sourceFile);
                if (init?.includes('submit')) hasSubmit = true;
              }
            }
          }

          // Check if parent is a Radix trigger with asChild (e.g. <Collapsible.Trigger asChild>)
          let isInsideAsChildTrigger = false;
          if (parent && ts.isJsxElement(parent)) {
            const parentOpening = parent.openingElement;
            const parentName = parentOpening.tagName.getText(sourceFile);
            if (parentName.includes('Trigger')) {
              for (const attr of parentOpening.attributes.properties) {
                if (ts.isJsxAttribute(attr) && attr.name.getText(sourceFile) === 'asChild') {
                  isInsideAsChildTrigger = true;
                }
              }
            }
          }

          if (tagName === 'button' || isButtonRole) {
            if (!hasOnClick && !hasSubmit && !hasAsChild && !hasInertReason && !isInsideAsChildTrigger) {
              const lineAndChar = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
              violations.push({
                file: path.relative(srcDir, file),
                line: lineAndChar.line + 1,
                tag: `<${tagName}>`,
              });
            }
          }
        }

        ts.forEachChild(node, (child) => visit(child, node));
      }

      visit(sourceFile);
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `\n[${v.file}:${v.line}] -> ${v.tag}`)
        .join('');
      expect.fail(`Found ${violations.length} dead control(s) lacking onClick, type="submit", asChild, or data-inert-reason:${details}`);
    } else {
      expect(violations).toHaveLength(0);
    }
  });
});
