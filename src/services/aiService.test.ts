import assert from 'node:assert/strict';
import { __test__ } from './aiService';

const { extractJSON, validateBookTitles, validateCharacters, validateTOC, validateSegments } = __test__;

assert.deepEqual(extractJSON('```json\n{"ok":true}\n```'), { ok: true });

assert.deepEqual(
  validateBookTitles({
    titles: [
      { title: '逆天归来', intro: '废柴少年重回巅峰，横扫宿敌' },
      { title: '', intro: '无效' },
    ],
  }),
  [{ title: '逆天归来', intro: '废柴少年重回巅峰，横扫宿敌' }]
);

assert.equal(
  validateCharacters({
    characters: [
      { id: 'char1', name: '林澈', role: '主角', description: '背负家族秘密，性格坚韧。' },
      { id: 'char2', name: '林澈', role: '配角', description: '重复姓名会被过滤。' },
    ],
  }).length,
  1
);

assert.deepEqual(
  validateTOC(
    {
      chapters: [
        { chapterNumber: 1, title: '风起青山', summary: '主角发现旧案线索，踏出第一步。' },
        { chapterNumber: 2, title: '夜探祠堂', summary: '主角潜入祠堂，确认仇敌仍在布局。' },
      ],
    },
    1,
    2,
    []
  ).map(item => item.chapterNumber),
  [1, 2]
);

// 重复标题被跳过，只保留有效章（不再整批 throw）
assert.deepEqual(
  validateTOC(
    {
      chapters: [
        { chapterNumber: 1, title: '重复标题', summary: '这一章标题已经存在。' },
        { chapterNumber: 2, title: '新标题', summary: '第二章有效。' },
      ],
    },
    1,
    2,
    ['重复标题']
  ).map(item => item.chapterNumber),
  [2]
);

// 过早结局感标题：自动软改写并保留，不 throw；中性隐喻标题保留
{
  const fixed = validateTOC(
    {
      chapters: [
        { chapterNumber: 20, title: '最后的决战', summary: '过早使用结局感标题。' },
        { chapterNumber: 13, title: '没有终点站', summary: '中期推进，隐喻前路。' },
      ],
    },
    13,
    20,
    [],
    100
  );
  assert.equal(fixed.length, 2);
  const titles = fixed.map(x => x.title);
  assert.ok(!titles.includes('最后的决战'), '决战类应被改写');
  assert.ok(titles.includes('没有终点站'), '中性隐喻标题应保留');
  assert.ok(((fixed as any).__sanitizedNotes || []).length >= 1);
}

assert.equal(
  validateTOC(
    {
      chapters: [
        { chapterNumber: 100, title: '最终大结局', summary: '所有伏笔收束，故事完成。' },
      ],
    },
    100,
    100,
    [],
    100
  )[0].title,
  '最终大结局'
);

assert.equal(
  validateSegments([
    { segmentNumber: 1, title: '开端', wordCount: 1500, summary: '主角陷入危机。' },
  ])[0].isGenerated,
  false
);

console.log('aiService quality tests passed');
