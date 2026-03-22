import type { BinaryContract, BinaryContractCallable, BinaryContractMethod } from './binary-contract'
import { makeDiagnostic, makeFieldPath, type ContractDiagnostic } from './contract-diagnostics.ts'

export interface ContractValidationOptions {
  supportedMetadataMajorVersion: number
}

export function validateBinaryContract(
  contract: BinaryContract,
  options: ContractValidationOptions,
): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = []
  // D6-09 / D6-10: apply the same strict rules to all libraries from all sources.

  if (contract.metadataMajorVersion !== options.supportedMetadataMajorVersion) {
    diagnostics.push(makeDiagnostic({
      level: 'ERROR',
      code: 'CONTRACT_METADATA_MAJOR_MISMATCH',
      libraryGuid: contract.libraryGuid,
      libraryName: contract.libraryName,
      filePath: contract.filePath,
      fieldPath: 'metadataMajorVersion',
      message: `metadata major ${contract.metadataMajorVersion} is not supported`,
      suggestion: `use metadata major ${options.supportedMetadataMajorVersion}`,
    }))
  }

  contract.events.forEach((event, index) => {
    requireField(diagnostics, contract, event.name, makeFieldPath('events', index, 'name'), 'CONTRACT_MISSING_EVENT_FIELD', '事件名缺失', '补充事件名')
    requireField(diagnostics, contract, event.route.channel, makeFieldPath('events', index, 'route', 'channel'), 'CONTRACT_MISSING_EVENT_FIELD', '事件消息通道缺失', '补充 WM_COMMAND/WM_NOTIFY/WM_HSCROLL/WM_VSCROLL')
    requireField(diagnostics, contract, event.route.code, makeFieldPath('events', index, 'route', 'code'), 'CONTRACT_MISSING_EVENT_FIELD', '事件通知码/消息码缺失', '补充通知码或消息码')
    requireField(diagnostics, contract, event.route.argExtractRule, makeFieldPath('events', index, 'route', 'argExtractRule'), 'CONTRACT_MISSING_EVENT_FIELD', '事件参数提取规则缺失', '补充参数提取规则')
  })

  contract.properties.forEach((property, index) => {
    requireField(diagnostics, contract, property.name, makeFieldPath('properties', index, 'name'), 'CONTRACT_MISSING_PROPERTY_FIELD', '属性名缺失', '补充属性名')
    requireField(diagnostics, contract, property.type, makeFieldPath('properties', index, 'type'), 'CONTRACT_MISSING_PROPERTY_FIELD', '属性类型缺失', '补充属性类型')
    requireField(diagnostics, contract, property.readWrite, makeFieldPath('properties', index, 'readWrite'), 'CONTRACT_MISSING_PROPERTY_FIELD', '属性读写语义缺失', '补充 read/write/readwrite')
    requireField(diagnostics, contract, property.defaultValueSemantics, makeFieldPath('properties', index, 'defaultValueSemantics'), 'CONTRACT_MISSING_PROPERTY_FIELD', '属性默认值语义缺失', '补充默认值语义')
    requireField(diagnostics, contract, property.cConversionRule, makeFieldPath('properties', index, 'cConversionRule'), 'CONTRACT_MISSING_PROPERTY_FIELD', '属性 C 转换规则缺失', '补充 C 侧转换规则')
  })

  contract.functions.forEach((func, index) => validateCallable(diagnostics, contract, func, makeFieldPath('functions', index)))
  contract.methods.forEach((method, index) => validateMethod(diagnostics, contract, method, makeFieldPath('methods', index)))

  if (diagnostics.length === 0) {
    diagnostics.push(makeDiagnostic({
      level: 'INFO',
      code: 'CONTRACT_VALID',
      libraryGuid: contract.libraryGuid,
      libraryName: contract.libraryName,
      filePath: contract.filePath,
      fieldPath: 'contract',
      message: 'Binary contract is valid',
      suggestion: 'No action required',
    }))
  }

  return diagnostics
}

function validateCallable(
  diagnostics: ContractDiagnostic[],
  contract: BinaryContract,
  callable: BinaryContractCallable,
  basePath: string,
): void {
  requireField(diagnostics, contract, callable.callingConvention, `${basePath}.callingConvention`, 'CONTRACT_MISSING_FUNCTION_FIELD', '调用约定缺失', '补充 callingConvention')
  if (!Array.isArray(callable.paramDirections) || callable.paramDirections.length === 0) {
    diagnostics.push(makeDiagnostic({
      level: 'ERROR',
      code: 'CONTRACT_MISSING_FUNCTION_FIELD',
      libraryGuid: contract.libraryGuid,
      libraryName: contract.libraryName,
      filePath: contract.filePath,
      fieldPath: `${basePath}.paramDirections`,
      message: '参数方向缺失',
      suggestion: '补充 in/out/ref 参数方向',
    }))
  }
  requireField(diagnostics, contract, callable.returnMapping, `${basePath}.returnMapping`, 'CONTRACT_MISSING_FUNCTION_FIELD', '返回值映射缺失', '补充 returnMapping')
  requireField(diagnostics, contract, callable.bindingSymbol, `${basePath}.bindingSymbol`, 'CONTRACT_MISSING_FUNCTION_FIELD', '绑定符号缺失', '补充 bindingSymbol')
}

function validateMethod(
  diagnostics: ContractDiagnostic[],
  contract: BinaryContract,
  method: BinaryContractMethod,
  basePath: string,
): void {
  validateCallable(diagnostics, contract, method, basePath)
  requireField(diagnostics, contract, method.ownerTypeName, `${basePath}.ownerTypeName`, 'CONTRACT_MISSING_METHOD_FIELD', '方法归属类型缺失', '补充 ownerTypeName')
}

function requireField(
  diagnostics: ContractDiagnostic[],
  contract: BinaryContract,
  value: unknown,
  fieldPath: string,
  code: string,
  message: string,
  suggestion: string,
): void {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (normalized === '' || normalized === null || normalized === undefined) {
    diagnostics.push(makeDiagnostic({
      level: 'ERROR',
      code,
      libraryGuid: contract.libraryGuid,
      libraryName: contract.libraryName,
      filePath: contract.filePath,
      fieldPath,
      message,
      suggestion,
    }))
  }
}
