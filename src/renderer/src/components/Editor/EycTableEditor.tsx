import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import './EycTableEditor.css'

// ========== 数据结构 ==========

type DeclType =
  | 'assembly' | 'assemblyVar' | 'sub' | 'subParam' | 'localVar'
  | 'globalVar' | 'constant' | 'dataType' | 'dataTypeMember'
  | 'dll' | 'image' | 'sound'

interface ParsedLine {
  type: DeclType | 'version' | 'supportLib' | 'blank' | 'comment' | 'code'
  raw: string
  fields: string[]
}

interface RenderBlock {
  kind: 'table' | 'codeline'
  tableType?: string
  rows: TblRow[]
  codeLine?: string
  lineIndex: number
  isVirtual?: boolean  // 自动生成的空代码行（子程序下保底行）
}

interface TblRow {
  cells: CellData[]
  lineIndex: number
  isHeader?: boolean
}

interface CellData {
  text: string
  cls: string
  colSpan?: number
  align?: string
  fieldIdx?: number    // 对应源码字段索引，undefined 表示不可编辑
  sliceField?: boolean // true 表示该字段取源码 fields[fieldIdx:] 拼接
}

// ========== 解析 ==========

function splitCSV(text: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) { cur += ch; if (ch === '"' || ch === '\u201d') inQ = false; continue }
    if (ch === '"' || ch === '\u201c') { inQ = true; cur += ch; continue }
    if (ch === ',' && i + 1 < text.length && text[i + 1] === ' ') {
      result.push(cur); cur = ''; i++; continue
    }
    cur += ch
  }
  result.push(cur)
  return result
}

function unquote(s: string): string {
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('\u201c') && s.endsWith('\u201d')))
    return s.slice(1, -1)
  return s
}

function parseLines(text: string): ParsedLine[] {
  return text.split('\n').map(line => {
    const t = line.replace(/[\r\t]/g, '').trim()
    if (!t) return { type: 'blank' as const, raw: line, fields: [] }
    if (t.startsWith('.版本 ')) return { type: 'version' as const, raw: line, fields: [] }
    if (t.startsWith('.支持库 ')) return { type: 'supportLib' as const, raw: line, fields: [t.slice(5)] }
    if (t.startsWith("'")) return { type: 'comment' as const, raw: line, fields: [t.slice(1)] }

    const lt = line.replace(/[\r\t]/g, '')
    const decls: [DeclType, string][] = [
      ['assembly', '.程序集 '], ['assemblyVar', '.程序集变量 '],
      ['sub', '.子程序 '], ['localVar', '.局部变量 '],
      ['globalVar', '.全局变量 '], ['constant', '.常量 '],
      ['dataType', '.数据类型 '], ['dll', '.DLL命令 '],
      ['image', '.图片 '], ['sound', '.声音 '],
    ]
    for (const [dt, pf] of decls) {
      if (t.startsWith(pf)) return { type: dt, raw: line, fields: splitCSV(t.slice(pf.length)) }
    }
    if (lt.startsWith('    .成员 ') || t.startsWith('.成员 ')) {
      const pf = lt.startsWith('    .成员 ') ? '    .成员 ' : '.成员 '
      return { type: 'dataTypeMember' as DeclType, raw: line, fields: splitCSV((lt.startsWith('    .成员 ') ? lt : t).slice(pf.length)) }
    }
    if (lt.startsWith('    .参数 ') || t.startsWith('.参数 ')) {
      const pf = lt.startsWith('    .参数 ') ? '    .参数 ' : '.参数 '
      return { type: 'subParam' as DeclType, raw: line, fields: splitCSV((lt.startsWith('    .参数 ') ? lt : t).slice(pf.length)) }
    }
    return { type: 'code' as const, raw: line, fields: [] }
  })
}

// ========== 构建渲染块 ==========

function buildBlocks(text: string): RenderBlock[] {
  const lines = parseLines(text)
  const blocks: RenderBlock[] = []
  let tbl: RenderBlock | null = null
  let he = 0

  const flush = (): void => { if (tbl) { blocks.push(tbl); tbl = null } }
  const newTbl = (type: string, hdr: string[], li: number, hdrCls = 'eHeadercolor'): void => {
    tbl = { kind: 'table', tableType: type, rows: [], lineIndex: li }
    tbl.rows.push({ cells: hdr.map(h => ({ text: h, cls: hdrCls })), lineIndex: li, isHeader: true })
  }
  const addHdr = (hdr: string[], li: number, hdrCls = 'eHeadercolor'): void => {
    if (tbl) tbl.rows.push({ cells: hdr.map(h => ({ text: h, cls: hdrCls })), lineIndex: li, isHeader: true })
  }
  const pushRow = (li: number, cells: CellData[]): void => {
    if (tbl) tbl.rows.push({ lineIndex: li, cells })
  }
  const pushHdrRow = (li: number, cells: CellData[]): void => {
    if (tbl) tbl.rows.push({ lineIndex: li, cells, isHeader: true })
  }

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const f = ln.fields

    if (ln.type === 'version' || ln.type === 'supportLib') continue

    if (ln.type === 'blank') {
      // 子程序声明区后的空行：视为代码区域过渡
      if (he === 1 || he === 2 || he === 11) { flush(); he = 0 }
      if (he === 0) blocks.push({ kind: 'codeline', rows: [], codeLine: '', lineIndex: i })
      continue
    }

    if (ln.type === 'comment') {
      if (he !== 0) { flush(); he = 0 }
      blocks.push({ kind: 'codeline', rows: [], codeLine: ln.raw, lineIndex: i })
      continue
    }

    // 程序集
    if (ln.type === 'assembly') {
      flush()
      const rest = ln.raw.replace(/[\r\t]/g, '').trim().slice('.程序集 '.length)
      const parts = rest.split(', , , ')
      const name = parts[0] || ''
      const remark = parts[1] || ''
      newTbl('assembly', ['窗口程序集名', '保 留\u00A0\u00A0', '保 留', '备 注'], i, 'eAssemblycolor')
      pushRow(i, [
        { text: name, cls: 'eProcolor', fieldIdx: 0 },
        { text: '\u00A0', cls: '' },
        { text: '\u00A0', cls: '' },
        { text: remark, cls: 'Remarkscolor', fieldIdx: 3, sliceField: true },
      ])
      he = 3; continue
    }

    // 程序集变量
    if (ln.type === 'assemblyVar') {
      if (he !== 3 && he !== 10) {
        flush()
        newTbl('assembly', ['窗口程序集名', '保 留\u00A0\u00A0', '保 留', '备 注'], i, 'eAssemblycolor')
        pushRow(i, [
          { text: '(未填写程序集名)', cls: 'Wrongcolor' },
          { text: '\u00A0', cls: '' }, { text: '\u00A0', cls: '' }, { text: '\u00A0', cls: '' },
        ])
      }
      if (he !== 10) {
        addHdr(['变量名', '类 型', '数组', '备 注 '], i, 'eAssemblycolor')
      }
      pushRow(i, [
        { text: f[0] || '', cls: 'Variablescolor', fieldIdx: 0 },
        { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
        { text: f.length > 3 ? unquote(f[3]) : '\u00A0', cls: 'eArraycolor', fieldIdx: 3 },
        { text: f.length > 4 ? f.slice(4).join(', ') : '\u00A0', cls: 'Remarkscolor', fieldIdx: 4, sliceField: true },
      ])
      he = 10; continue
    }

    // 子程序
    if (ln.type === 'sub') {
      flush()
      tbl = { kind: 'table', tableType: 'sub', rows: [], lineIndex: i }
      tbl.rows.push({ lineIndex: i, isHeader: true, cells: [
        { text: '子程序名', cls: 'eHeadercolor' },
        { text: '返回值类型', cls: 'eHeadercolor' },
        { text: '公开', cls: 'eHeadercolor' },
        { text: '备 注', cls: 'eHeadercolor', colSpan: 3 },
      ]})
      tbl.rows.push({ lineIndex: i, cells: [
        { text: f[0] || '', cls: 'eProcolor', fieldIdx: 0 },
        { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
        { text: f[2] === '公开' ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 3 ? f.slice(3).join(', ') : '', cls: 'Remarkscolor', colSpan: 3, fieldIdx: 3, sliceField: true },
      ]})
      he = 1; continue
    }

    // 参数
    if (ln.type === 'subParam') {
      if (he === 4) {
        // DLL 参数
        const flags = f[2] || ''
        pushRow(i, [
          { text: f[0] || '', cls: 'Variablescolor', fieldIdx: 0 },
          { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
          { text: flags.includes('传址') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
          { text: flags.includes('数组') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
          { text: f.length > 3 ? f.slice(3).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 3, sliceField: true },
        ])
        continue
      }
      if (he !== 1 && he !== 11) {
        flush()
        tbl = { kind: 'table', tableType: 'sub', rows: [], lineIndex: i }
        tbl.rows.push({ lineIndex: i, isHeader: true, cells: [
          { text: '子程序名', cls: 'eHeadercolor' },
          { text: '返回值类型', cls: 'eHeadercolor' },
          { text: '公开', cls: 'eHeadercolor' },
          { text: '备 注', cls: 'eHeadercolor', colSpan: 3 },
        ]})
        tbl.rows.push({ lineIndex: i, cells: [
          { text: '(未填写子程序名)', cls: 'Wrongcolor' },
          { text: '\u00A0', cls: '' }, { text: '\u00A0', cls: '' }, { text: '\u00A0', cls: '', colSpan: 3 },
        ]})
      }
      if (he !== 11) {
        addHdr(['参数名', '类 型', '参考', '可空', '数组', '备 注'], i)
      }
      const flags = f[2] || ''
      pushRow(i, [
        { text: f[0] || '', cls: 'Variablescolor', fieldIdx: 0 },
        { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
        { text: flags.includes('参考') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: flags.includes('可空') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: flags.includes('数组') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 3 ? f.slice(3).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 3, sliceField: true },
      ])
      he = 11; continue
    }

    // 局部变量
    if (ln.type === 'localVar') {
      if (he !== 2) {
        if (he !== 1 && he !== 11 && he !== 2) { flush() }
        if (!tbl) {
          newTbl('localVar', ['变量名', '类 型', '静态', '数组', '备 注'], i, 'eVariableheadcolor')
        } else {
          addHdr(['变量名', '类 型', '静态', '数组', '备 注'], i, 'eVariableheadcolor')
        }
      }
      pushRow(i, [
        { text: f[0] || '', cls: 'Variablescolor', fieldIdx: 0 },
        { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
        { text: f[2] === '静态' ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 3 ? unquote(f[3]) : '\u00A0', cls: 'eArraycolor', fieldIdx: 3 },
        { text: f.length > 4 ? f.slice(4).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 4, sliceField: true },
      ])
      he = 2; continue
    }

    // 全局变量
    if (ln.type === 'globalVar') {
      if (he !== 6) {
        flush()
        newTbl('globalVar', ['全局变量名', '类 型', '数组', '公开', '备 注'], i)
      }
      pushRow(i, [
        { text: f[0] || '', cls: 'Variablescolor', fieldIdx: 0 },
        { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
        { text: f.length > 3 ? unquote(f[3]) : '\u00A0', cls: 'eArraycolor', fieldIdx: 3 },
        { text: f[2]?.includes('公开') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 4 ? f.slice(4).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 4, sliceField: true },
      ])
      he = 6; continue
    }

    // 常量
    if (ln.type === 'constant') {
      if (he !== 9) {
        flush()
        newTbl('constant', ['常量名称', '常量值', '公 开', '备 注'], i)
      }
      pushRow(i, [
        { text: f[0] || '', cls: 'eOthercolor', fieldIdx: 0 },
        { text: f.length > 1 ? unquote(f[1]) : '\u00A0', cls: 'Constanttext', fieldIdx: 1 },
        { text: f[2] === '公开' ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 3 ? f.slice(3).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 3, sliceField: true },
      ])
      he = 9; continue
    }

    // 数据类型
    if (ln.type === 'dataType') {
      flush()
      newTbl('dataType', ['数据类型名', '公开', '备 注'], i)
      pushRow(i, [
        { text: f[0] || '', cls: 'eProcolor', fieldIdx: 0 },
        { text: f[1]?.includes('公开') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 2 ? f.slice(2).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 2, sliceField: true },
      ])
      addHdr(['成员名', '类 型', '传址', '数组', '备 注 '], i)
      he = 8; continue
    }

    // 数据类型成员
    if (ln.type === 'dataTypeMember') {
      if (he !== 8) {
        flush()
        newTbl('dataType', ['数据类型名', '公开', '备 注'], i)
        pushRow(i, [
          { text: '(未定义数据类型名)', cls: 'Wrongcolor' },
          { text: '\u00A0', cls: '' }, { text: '\u00A0', cls: '' },
        ])
        addHdr(['成员名', '类 型', '传址', '数组', '备 注 '], i)
      }
      pushRow(i, [
        { text: f[0] || '', cls: 'Variablescolor', fieldIdx: 0 },
        { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
        { text: f[2] === '传址' ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 3 ? unquote(f[3]) : '\u00A0', cls: 'eArraycolor', fieldIdx: 3 },
        { text: f.length > 4 ? f.slice(4).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 4, sliceField: true },
      ])
      he = 8; continue
    }

    // DLL 命令
    if (ln.type === 'dll') {
      flush()
      newTbl('dll', ['DLL命令名', '返回值类型', '公开', '备 注'], i)
      pushRow(i, [
        { text: f[0] || '', cls: 'eProcolor', fieldIdx: 0 },
        { text: f[1] || '\u00A0', cls: 'eTypecolor', fieldIdx: 1 },
        { text: f[4] === '公开' ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 5 ? f.slice(5).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 5, sliceField: true },
      ])
      {
        const libFile = f[2] ? unquote(f[2]) : ''
        const cmdName = f[3] ? unquote(f[3]) : ''
        pushHdrRow(i, [{ text: 'DLL库文件名:', cls: 'eHeadercolor', colSpan: 5 }])
        pushRow(i, [{ text: libFile || '(未填写库文件名)', cls: libFile ? 'eAPIcolor' : 'Wrongcolor', colSpan: 5, fieldIdx: 2 }])
        pushHdrRow(i, [{ text: '在DLL库中对应命令名:', cls: 'eHeadercolor', colSpan: 5 }])
        pushRow(i, [{ text: cmdName || '(未填写命令名)', cls: cmdName ? 'eAPIcolor' : 'Wrongcolor', colSpan: 5, fieldIdx: 3 }])
      }
      addHdr(['参数名', '类 型', '传址', '数组', '备 注 '], i)
      he = 4; continue
    }

    // 图片
    if (ln.type === 'image') {
      if (he !== 5) { flush(); newTbl('image', ['图片或图片组名称', '内容', '公开', '备 注'], i) }
      pushRow(i, [
        { text: f[0] || '', cls: 'eOthercolor', fieldIdx: 0 },
        { text: '\u00A0\u00A0\u00A0\u00A0', cls: '' },
        { text: f[1]?.includes('公开') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 2 ? f.slice(2).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 2, sliceField: true },
      ])
      he = 5; continue
    }

    // 声音
    if (ln.type === 'sound') {
      if (he !== 7) { flush(); newTbl('sound', ['声音名称', '内容', '公开', '备 注'], i) }
      pushRow(i, [
        { text: f[0] || '', cls: 'eOthercolor', fieldIdx: 0 },
        { text: '\u00A0\u00A0\u00A0\u00A0', cls: '' },
        { text: f[1]?.includes('公开') ? '√' : '\u00A0', cls: 'eTickcolor', align: 'center' },
        { text: f.length > 2 ? f.slice(2).join(', ') : '', cls: 'Remarkscolor', fieldIdx: 2, sliceField: true },
      ])
      he = 7; continue
    }

    // 代码行
    if (ln.type === 'code') {
      if (he !== 0) { flush(); he = 0 }
      blocks.push({ kind: 'codeline', rows: [], codeLine: ln.raw, lineIndex: i })
      continue
    }
  }

  flush()

  // 后处理：确保每个子程序表格后至少有一个代码行
  const processed: RenderBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    processed.push(blocks[i])
    if (blocks[i].kind === 'table' && blocks[i].tableType === 'sub') {
      const next = blocks[i + 1]
      if (!next || next.kind !== 'codeline') {
        // 找到子程序表格最后一行的 lineIndex
        const lastRow = blocks[i].rows[blocks[i].rows.length - 1]
        const afterLine = lastRow ? lastRow.lineIndex : blocks[i].lineIndex
        processed.push({
          kind: 'codeline',
          rows: [],
          codeLine: '',
          lineIndex: afterLine,
          isVirtual: true,
        })
      }
    }
  }
  return processed
}

// ========== 代码行着色 ==========

interface Span { text: string; cls: string }

const FLOW_KW = new Set([
  '如果真', '如果真结束', '判断', '判断开始', '判断结束', '默认', '否则',
  '如果', '返回', '结束', '到循环尾', '跳出循环',
  '循环判断首', '循环判断尾', '判断循环首', '判断循环尾',
  '计次循环首', '计次循环尾', '变量循环首', '变量循环尾', '如果结束',
])

function colorize(raw: string): Span[] {
  const trimmed = raw.replace(/[\r\t]/g, '')
  const stripped = trimmed.replace(/^ +/, '')
  const indent = trimmed.length - stripped.length
  if (!stripped) return [{ text: '', cls: '' }]

  // 注释
  if (stripped.startsWith("'")) {
    return [
      ...(indent > 0 ? [{ text: '\u00A0'.repeat(indent), cls: '' }] : []),
      { text: stripped, cls: 'Remarkscolor' },
    ]
  }

  // 提取备注
  let code = stripped, remark = ''
  const ri = findRemark(stripped)
  if (ri >= 0) { code = stripped.slice(0, ri).trimEnd(); remark = stripped.slice(ri) }

  const spans: Span[] = []

  // 缩进树线
  if (indent > 0) {
    const lvl = Math.floor(indent / 4)
    for (let l = 0; l < lvl; l++) spans.push({ text: '\u2502\u00A0\u00A0\u00A0', cls: 'eTreeLine' })
    const ex = indent % 4
    if (ex > 0) spans.push({ text: '\u00A0'.repeat(ex), cls: '' })
  }

  // 流程控制以.开头
  if (code.startsWith('.')) {
    const kw = code.split(/[\s(（]/)[0]
    if (FLOW_KW.has(kw.slice(1))) {
      spans.push({ text: kw, cls: 'comecolor' })
      if (code.length > kw.length) spans.push(...colorExpr(code.slice(kw.length)))
    } else {
      spans.push(...colorExpr(code))
    }
  } else {
    spans.push(...colorExpr(code))
  }

  if (remark) { spans.push({ text: ' ', cls: '' }); spans.push({ text: remark, cls: 'Remarkscolor' }) }
  return spans
}

function findRemark(s: string): number {
  let inS = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inS) { if (c === '"' || c === '\u201d') inS = false; continue }
    if (c === '"' || c === '\u201c') { inS = true; continue }
    if (c === "'" && i > 0) return i
  }
  return -1
}

function colorExpr(expr: string): Span[] {
  const out: Span[] = []
  let r = expr
  while (r.length > 0) {
    // 字符串
    const sm = r.match(/^([""\u201c])(.*?)([""\u201d])/)
    if (sm && r.startsWith(sm[1])) { out.push({ text: sm[0], cls: 'eTxtcolor' }); r = r.slice(sm[0].length); continue }

    // 常量 #
    if (r.startsWith('#')) {
      const end = r.slice(1).search(/[\s(（)）,，+＋\-－×÷=＝>＞<＜≥≤≈≠;：]/)
      const cn = end >= 0 ? r.slice(0, end + 1) : r
      out.push({ text: cn, cls: 'conscolor' }); r = r.slice(cn.length); continue
    }

    // 真/假
    const bm = r.match(/^(真|假)(?=[\s(（)）,，=＝]|$)/)
    if (bm) { out.push({ text: bm[0], cls: 'conscolor' }); r = r.slice(bm[0].length); continue }

    // 且/或
    const lm = r.match(/^(且|或)(?=[\s(（)）,，]|$)/)
    if (lm) { out.push({ text: lm[0], cls: 'funccolor' }); r = r.slice(lm[0].length); continue }

    // 括号
    if ('()（）{}[]'.includes(r[0])) { out.push({ text: r[0], cls: 'conscolor' }); r = r.slice(1); continue }

    // 函数调用（名字后面紧跟括号）
    const fm = r.match(/^([\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_.]*)\s*(?=[(\uff08])/)
    if (fm) {
      const name = fm[1]
      if (name.includes('.')) { out.push({ text: name, cls: 'cometwolr' }) }
      else if (FLOW_KW.has(name)) { out.push({ text: name, cls: 'comecolor' }) }
      else { out.push({ text: name, cls: 'funccolor' }) }
      r = r.slice(name.length); continue
    }

    // 普通文本
    const pm = r.match(/^[^""\u201c#(（)）{}\[\]]+/)
    if (pm) { out.push({ text: pm[0], cls: '' }); r = r.slice(pm[0].length); continue }
    out.push({ text: r[0], cls: '' }); r = r.slice(1)
  }
  return out
}

// ========== 行重建 ==========

const DECL_PREFIXES = [
  '.程序集变量 ', '.程序集 ', '.子程序 ', '.局部变量 ',
  '.全局变量 ', '.常量 ', '.数据类型 ', '.DLL命令 ',
  '.图片 ', '.声音 ', '.参数 ', '.成员 ',
]

function rebuildLineField(rawLine: string, fieldIdx: number, newValue: string, isSlice: boolean): string {
  const line = rawLine.replace(/\r/g, '')
  const stripped = line.replace(/^ +/, '')
  const indent = line.length - stripped.length

  for (const pf of DECL_PREFIXES) {
    if (stripped.startsWith(pf)) {
      const fieldsStr = stripped.slice(pf.length)
      const fields = splitCSV(fieldsStr)

      if (isSlice) {
        fields.splice(fieldIdx, fields.length - fieldIdx, newValue)
      } else {
        while (fields.length <= fieldIdx) fields.push('')
        fields[fieldIdx] = newValue
      }

      // 去除尾部空字段，避免产生多余逗号
      while (fields.length > 0 && fields[fields.length - 1] === '') fields.pop()

      return ' '.repeat(indent) + pf + fields.join(', ')
    }
  }

  return rawLine
}

// ========== 组件 ==========

export interface EycTableEditorHandle {
  insertSubroutine: () => void
}

interface EycTableEditorProps {
  value: string
  onChange: (value: string) => void
}

interface EditState {
  lineIndex: number
  cellIndex: number
  fieldIdx: number    // -1 表示无字段映射（代码行编辑整行）
  sliceField: boolean
  isVirtual?: boolean // 虚拟代码行（编辑时插入而非替换）
}

const EycTableEditor = forwardRef<EycTableEditorHandle, EycTableEditorProps>(function EycTableEditor({ value, onChange }, ref) {
  const [editCell, setEditCell] = useState<EditState | null>(null)
  const [editVal, setEditVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const prevRef = useRef(value)
  const [currentText, setCurrentText] = useState(value)
  const lastFocusedLine = useRef<number>(-1)

  useEffect(() => {
    if (value !== prevRef.current) { setCurrentText(value); prevRef.current = value }
  }, [value])

  const lines = useMemo(() => currentText.split('\n'), [currentText])
  const blocks = useMemo(() => buildBlocks(currentText), [currentText])

  const commit = useCallback(() => {
    if (!editCell) return
    if (editCell.cellIndex < 0) {
      if (editCell.isVirtual) {
        // 虚拟代码行：插入新行而非替换
        const nl = [...lines]
        nl.splice(editCell.lineIndex + 1, 0, editVal)
        const nt = nl.join('\n')
        setCurrentText(nt); prevRef.current = nt; onChange(nt); setEditCell(null)
        return
      }
      // 代码行编辑：直接替换整行
      const nl = [...lines]; nl[editCell.lineIndex] = editVal
      const nt = nl.join('\n')
      setCurrentText(nt); prevRef.current = nt; onChange(nt); setEditCell(null)
      return
    }
    if (editCell.fieldIdx < 0) {
      // 无字段映射（如 tick 单元格），不修改
      setEditCell(null)
      return
    }
    // 表格单元格编辑：重建字段
    const rawLine = lines[editCell.lineIndex]
    const newLine = rebuildLineField(rawLine, editCell.fieldIdx, editVal, editCell.sliceField)
    const nl = [...lines]; nl[editCell.lineIndex] = newLine
    const nt = nl.join('\n')
    setCurrentText(nt); prevRef.current = nt; onChange(nt); setEditCell(null)
  }, [editCell, editVal, lines, onChange])

  const startEditCell = useCallback((li: number, ci: number, cellText: string, fieldIdx?: number, sliceField?: boolean) => {
    if (fieldIdx === undefined) return // 无字段映射（tick 单元格等），不可编辑
    lastFocusedLine.current = li
    setEditCell({ lineIndex: li, cellIndex: ci, fieldIdx, sliceField: sliceField || false })
    setEditVal(cellText || '')
    setTimeout(() => { inputRef.current?.focus() }, 0)
  }, [])

  const startEditLine = useCallback((li: number, clientX?: number, containerLeft?: number, isVirtual?: boolean) => {
    const text = isVirtual ? '' : (lines[li] || '')
    lastFocusedLine.current = li
    setEditCell({ lineIndex: li, cellIndex: -1, fieldIdx: -1, sliceField: false, isVirtual }); setEditVal(text)
    setTimeout(() => {
      if (!inputRef.current) return
      inputRef.current.focus()
      if (clientX !== undefined && containerLeft !== undefined) {
        const relX = clientX - containerLeft // 相对于代码行内容区域
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.font = '13px Consolas, "Microsoft YaHei", monospace'
          let pos = text.length
          for (let i = 1; i <= text.length; i++) {
            const w = ctx.measureText(text.slice(0, i)).width
            if (w > relX) {
              const wPrev = ctx.measureText(text.slice(0, i - 1)).width
              pos = (relX - wPrev < w - relX) ? i - 1 : i
              break
            }
          }
          inputRef.current.selectionStart = pos
          inputRef.current.selectionEnd = pos
        }
      }
    }, 0)
  }, [lines])

  const onKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (editCell && editCell.cellIndex < 0) {
        const cur = e.currentTarget
        const pos = cur.selectionStart ?? editVal.length
        const before = editVal.slice(0, pos)
        const after = editVal.slice(pos)
        const nl = [...lines]
        if (editCell.isVirtual) {
          // 虚拟代码行：插入两行（光标前/后）
          nl.splice(editCell.lineIndex + 1, 0, before, after)
          const nt = nl.join('\n')
          setCurrentText(nt); prevRef.current = nt; onChange(nt)
          const newLi = editCell.lineIndex + 2
          setEditCell({ lineIndex: newLi, cellIndex: -1, fieldIdx: -1, sliceField: false })
          setEditVal(after)
        } else {
          // 代码行：在光标位置拆行，插入新行
          nl[editCell.lineIndex] = before
          nl.splice(editCell.lineIndex + 1, 0, after)
          const nt = nl.join('\n')
          setCurrentText(nt); prevRef.current = nt; onChange(nt)
          const newLi = editCell.lineIndex + 1
          setEditCell({ lineIndex: newLi, cellIndex: -1, fieldIdx: -1, sliceField: false })
          setEditVal(after)
        }
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus()
            inputRef.current.selectionStart = 0
            inputRef.current.selectionEnd = 0
          }
        }, 0)
      } else if (editCell && editCell.cellIndex >= 0 && editCell.fieldIdx >= 0) {
        // 表格行：先提交当前编辑，再插入同类型新行
        const li = editCell.lineIndex
        let rawLine = lines[li]
        rawLine = rebuildLineField(rawLine, editCell.fieldIdx, editVal, editCell.sliceField)

        const stripped = rawLine.replace(/[\r\t]/g, '').trimStart()
        const rowTemplates: [string, string][] = [
          ['.子程序 ', '    .参数 , 整数型'],
          ['.程序集变量 ', '.程序集变量 , 整数型'],
          ['.局部变量 ', '.局部变量 , 整数型'],
          ['.全局变量 ', '.全局变量 , 整数型'],
          ['.参数 ', '    .参数 , 整数型'],
          ['.成员 ', '    .成员 , 整数型'],
          ['.常量 ', '.常量 , '],
        ]

        let newLine: string | null = null
        for (const [prefix, template] of rowTemplates) {
          if (stripped.startsWith(prefix)) {
            newLine = template
            break
          }
        }

        if (newLine) {
          const nl = [...lines]
          nl[li] = rawLine
          nl.splice(li + 1, 0, newLine)
          const nt = nl.join('\n')
          setCurrentText(nt); prevRef.current = nt; onChange(nt)
          // 开始编辑新行的名称单元格
          const newLi = li + 1
          setEditCell({ lineIndex: newLi, cellIndex: 0, fieldIdx: 0, sliceField: false })
          setEditVal('')
          setTimeout(() => { inputRef.current?.focus() }, 0)
        } else {
          commit()
        }
      } else {
        commit()
      }
    } else if (e.key === 'Escape') setEditCell(null)
  }, [commit, editCell, editVal, lines, onChange])

  // 插入子程序：在当前光标所处子程序后方插入，无光标时插入到末尾
  useImperativeHandle(ref, () => ({
    insertSubroutine: () => {
      const curLines = currentText.split('\n')
      const focusLi = lastFocusedLine.current

      // 收集已有子程序名，生成唯一名称
      const existingNames = new Set<string>()
      for (const ln of curLines) {
        const t = ln.replace(/[\r\t]/g, '').trim()
        if (t.startsWith('.子程序 ')) {
          const name = splitCSV(t.slice('.子程序 '.length))[0]
          if (name) existingNames.add(name)
        }
      }
      let num = 1
      while (existingNames.has('子程序' + num)) num++
      const newName = '子程序' + num

      let insertAt: number

      if (focusLi < 0) {
        // 无光标焦点：插入到文件末尾
        insertAt = curLines.length
      } else {
        // 先找光标所在或上方最近的 .子程序 声明行
        let curSubStart = -1
        for (let i = Math.min(focusLi, curLines.length - 1); i >= 0; i--) {
          const t = curLines[i].replace(/[\r\t]/g, '').trim()
          if (t.startsWith('.子程序 ')) { curSubStart = i; break }
          // 碰到程序集声明就停止（程序集表格始终在最上方）
          if (t.startsWith('.程序集 ')) break
        }

        // 找下一个子程序/程序集的起始行（即当前子程序的结束后）
        insertAt = curLines.length
        const searchStart = curSubStart >= 0 ? curSubStart + 1 : Math.max(focusLi + 1, 0)
        for (let i = searchStart; i < curLines.length; i++) {
          const t = curLines[i].replace(/[\r\t]/g, '').trim()
          if (t.startsWith('.子程序 ') || t.startsWith('.程序集 ')) {
            insertAt = i
            break
          }
        }
      }

      const newSubText = '\n.子程序 ' + newName + ', , , '
      const nl = [...curLines]
      nl.splice(insertAt, 0, newSubText)
      const nt = nl.join('\n')
      setCurrentText(nt); prevRef.current = nt; onChange(nt)
    }
  }), [currentText, onChange])

  return (
    <div className="eyc-table-editor ebackcolor1">
      <div className="eyc-table-wrapper">
        {blocks.map((blk, bi) => {
          if (blk.kind === 'table') {
            return (
              <div key={bi} className="eyc-block-row">
                <div className="eyc-line-gutter">
                  {blk.rows.map((row, ri) => (
                    <div key={ri} className="eyc-gutter-cell">
                      {row.isHeader ? '' : row.lineIndex + 1}
                    </div>
                  ))}
                </div>
                <div className="eyc-block-content">
                  <table className="eyc-decl-table" cellSpacing={0}>
                    <tbody>
                      {blk.rows.map((row, ri) => (
                        <tr
                          key={ri}
                          className={row.isHeader ? 'eyc-hdr-row' : 'eyc-data-row'}
                        >
                      {row.cells.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`${cell.cls} Rowheight`}
                          colSpan={cell.colSpan}
                          style={cell.align ? { textAlign: cell.align as 'center' } : undefined}
                          onClick={() => !row.isHeader && startEditCell(row.lineIndex, ci, cell.text, cell.fieldIdx, cell.sliceField)}
                        >
                          {editCell && editCell.lineIndex === row.lineIndex && editCell.cellIndex === ci && !row.isHeader ? (
                            <input
                              ref={inputRef}
                              className="eyc-cell-input"
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={commit}
                              onKeyDown={onKey}
                              spellCheck={false}
                            />
                          ) : (
                            cell.text || '\u00A0'
                          )}
                        </td>
                      ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )
          }

          // 代码行
          const spans = colorize(blk.codeLine || '')
          return (
            <div
              key={bi}
              className="eyc-block-row"
            >
              <div className="eyc-line-gutter">
                <div className="eyc-gutter-cell">{blk.isVirtual ? '' : blk.lineIndex + 1}</div>
              </div>
              <div
                className="eyc-code-line"
                onClick={(e) => {
                  startEditLine(blk.lineIndex, e.clientX, e.currentTarget.getBoundingClientRect().left, blk.isVirtual)
                }}
              >
              {editCell && editCell.lineIndex === blk.lineIndex && editCell.isVirtual === blk.isVirtual ? (
                <input
                  ref={inputRef}
                  className="eyc-inline-input"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={commit}
                  onKeyDown={onKey}
                  spellCheck={false}
                />
              ) : (
                <span className="eyc-code-spans">
                  {spans.map((s, si) => (
                    <span key={si} className={s.cls}>{s.text}</span>
                  ))}
                </span>
              )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default EycTableEditor
