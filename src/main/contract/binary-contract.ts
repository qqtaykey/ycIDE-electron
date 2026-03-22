import type { LibInfo, LibWindowUnit } from '../fne-parser'

export interface BinaryContractEvent {
  name: string
  route: {
    channel: string
    code: string
    argExtractRule: string
  }
  args: Array<{
    name: string
    dataType: string
    direction: 'in' | 'out' | 'ref'
  }>
  sourceWindowUnit: string
}

export interface BinaryContractProperty {
  name: string
  type: string
  readWrite: 'read' | 'write' | 'readwrite'
  defaultValueSemantics: string
  cConversionRule: string
  sourceWindowUnit: string
}

export interface BinaryContractCallable {
  name: string
  callingConvention: string
  paramDirections: Array<'in' | 'out' | 'ref'>
  returnMapping: string
  bindingSymbol: string
  sourceCommand: string
}

export interface BinaryContractMethod extends BinaryContractCallable {
  ownerTypeName: string
}

export interface BinaryContract {
  source: 'binary'
  libraryGuid: string
  libraryName: string
  filePath: string
  metadataMajorVersion: number
  events: BinaryContractEvent[]
  properties: BinaryContractProperty[]
  functions: BinaryContractCallable[]
  methods: BinaryContractMethod[]
}

export function deriveBinaryContract(info: LibInfo, filePath: string): BinaryContract {
  const metadataMajorVersion = parseMajorVersion(info.version)

  const events = info.windowUnits.flatMap((unit) => deriveEvents(unit))
  const properties = info.windowUnits.flatMap((unit) => deriveProperties(unit))
  const functions = info.commands
    .filter((cmd) => !cmd.isMember && !cmd.isHidden)
    .map((cmd) => ({
      name: cmd.name || '',
      callingConvention: inferCallingConvention(),
      paramDirections: cmd.params.map((param) => inferDirection(param.isVariable)),
      returnMapping: cmd.returnType || '',
      bindingSymbol: cmd.englishName || cmd.name || '',
      sourceCommand: cmd.name || '',
    }))
  const methods = info.commands
    .filter((cmd) => cmd.isMember && !cmd.isHidden)
    .map((cmd) => ({
      name: cmd.name || '',
      callingConvention: inferCallingConvention(),
      paramDirections: cmd.params.map((param) => inferDirection(param.isVariable)),
      returnMapping: cmd.returnType || '',
      bindingSymbol: cmd.englishName || cmd.name || '',
      sourceCommand: cmd.name || '',
      ownerTypeName: cmd.ownerTypeName || '',
    }))

  return {
    source: 'binary',
    libraryGuid: info.guid || '',
    libraryName: info.name || info.fileName || '',
    filePath,
    metadataMajorVersion,
    events,
    properties,
    functions,
    methods,
  }
}

function parseMajorVersion(version: string): number {
  const [major] = (version || '').split('.')
  const parsed = Number(major)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

function deriveEvents(unit: LibWindowUnit): BinaryContractEvent[] {
  return unit.events.map((event) => ({
    name: event.name || '',
    route: {
      channel: '',
      code: '',
      argExtractRule: event.args.length > 0 ? event.args.map((arg) => arg.name || 'arg').join(',') : '',
    },
    args: event.args.map((arg) => ({
      name: arg.name || '',
      dataType: arg.dataType || '',
      direction: inferDirection(arg.isByRef),
    })),
    sourceWindowUnit: unit.name || '',
  }))
}

function deriveProperties(unit: LibWindowUnit): BinaryContractProperty[] {
  return unit.properties.map((property) => ({
    name: property.name || '',
    type: property.typeName || '',
    readWrite: property.isReadOnly ? 'read' : 'readwrite',
    defaultValueSemantics: property.pickOptions.length > 0 ? 'pick-option' : '',
    cConversionRule: property.typeName || '',
    sourceWindowUnit: unit.name || '',
  }))
}

function inferCallingConvention(): string {
  return 'stdcall'
}

function inferDirection(isByRef: boolean): 'in' | 'out' | 'ref' {
  return isByRef ? 'ref' : 'in'
}
