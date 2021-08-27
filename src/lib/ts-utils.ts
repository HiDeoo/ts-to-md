import path from "path";
import glob from "glob";
import { existsSync, readFileSync } from "fs";
import { getTokenAtPosition } from "tsutils";
import {
  sys,
  Symbol,
  Program,
  SourceFile,
  Diagnostic,
  TypeChecker,
  CompilerHost,
  ScriptTarget,
  createProgram,
  CompilerOptions,
  createSourceFile,
  displayPartsToString,
  InterfaceDeclaration,
  isInterfaceDeclaration,
  isTypeAliasDeclaration,
  getPositionOfLineAndCharacter,
  TypeAliasDeclaration,
} from "typescript";

interface ProgramAndSourceFile {
  program: Program;
  sourceFile: SourceFile;
  checker: TypeChecker;
  diagnostics: readonly Diagnostic[];
}

interface SelectionStart {
  line: number;
  character: number;
}

type VirtualFS = Map<string, SourceFile>;
type FSEntry = { fileName: string; text: string };

const libFilesVirtualFS: VirtualFS = new Map();
const defaultLibFileNames: Set<string> = new Set();

function posixPath(input: string): string {
  return input.split(path.sep).join(path.posix.sep);
}

function forceTsExtension(input: string): string {
  if (![".ts", ".tsx"].includes(path.extname(input))) {
    return `${input}.ts`;
  }

  return input;
}

function getDefaultLibVirtualFS() {
  if (libFilesVirtualFS.size > 0) {
    return libFilesVirtualFS;
  }

  const cwd = path.dirname(sys.getExecutingFilePath());

  return createVirtualFS(
    glob.sync("lib.*.d.ts", { cwd }).map((fileName) => {
      defaultLibFileNames.add(fileName);
      return {
        fileName,
        text: readFileSync(path.join(cwd, fileName), "utf-8"),
      };
    })
  );
}

function createVirtualFS(
  entries: FSEntry[],
  target: ScriptTarget = ScriptTarget.ESNext
): VirtualFS {
  return new Map(
    entries.map(({ fileName, text }) => [
      fileName,
      createSourceFile(fileName, text, target),
    ])
  );
}

function createCompilerHost(
  virtualFS: VirtualFS,
  target: ScriptTarget = ScriptTarget.ESNext
): CompilerHost {
  return {
    getSourceFile: (fileName: string) => virtualFS.get(fileName),
    fileExists: (fileName: string) => {
      if (virtualFS.has(fileName)) {
        return true;
      }

      if (!existsSync(fileName)) {
        return false;
      }

      virtualFS.set(
        fileName,
        createSourceFile(fileName, readFileSync(fileName, "utf-8"), target)
      );

      return true;
    },
    getCanonicalFileName: (fileName: string) => fileName,
    readFile: () => "",
    writeFile: () => {},
    getNewLine: () => "\n",
    getDirectories: () => [],
    getCurrentDirectory: () => "/",
    getEnvironmentVariable: () => "",
    useCaseSensitiveFileNames: () => true,
    getDefaultLibFileName: () => "lib.d.ts",
  };
}

export function createProgramAndGetSourceFile(
  fileName: string,
  text: string,
  options: CompilerOptions = {}
): ProgramAndSourceFile {
  options.skipLibCheck = true;
  options.skipDefaultLibCheck = true;

  const target = ScriptTarget.ESNext;

  fileName = forceTsExtension(posixPath(fileName));

  const virtualFS = new Map([
    ...getDefaultLibVirtualFS(),
    ...createVirtualFS([{ fileName, text }], target),
  ]);

  const rootNames = [...defaultLibFileNames, fileName];
  const compilerHost = createCompilerHost(virtualFS, target);
  const program = createProgram(rootNames, options, compilerHost);
  const sourceFile = virtualFS.get(fileName)!;
  const checker = program.getTypeChecker();
  const diagnostics = program.getSemanticDiagnostics();

  return { program, diagnostics, sourceFile, checker };
}

function getNearestInterfaceFromPosition(
  sourceFile: SourceFile,
  position: number
): InterfaceDeclaration | null {
  if (position < 0) {
    return null;
  }

  const token = getTokenAtPosition(sourceFile, position);

  if (!token) {
    throw new Error(`No token found at ${sourceFile.fileName}:${position}`);
  }

  if (token.parent && isInterfaceDeclaration(token.parent)) {
    return token.parent;
  }

  return getNearestInterfaceFromPosition(sourceFile, position - 1);
}

export function getNearestInterface(
  sourceFile: SourceFile,
  { line, character }: SelectionStart
): InterfaceDeclaration | null {
  return getNearestInterfaceFromPosition(
    sourceFile,
    getPositionOfLineAndCharacter(sourceFile, line, character)
  );
}

export function getDocumentationCommentAsString(
  checker: TypeChecker,
  symbol: Symbol
): string {
  return displayPartsToString(symbol.getDocumentationComment(checker));
}

function getNearestTypeFromPosition(
  sourceFile: SourceFile,
  position: number
): TypeAliasDeclaration | InterfaceDeclaration | null {
  if (position < 0) {
    return null;
  }

  const token = getTokenAtPosition(sourceFile, position);

  if (!token) {
    throw new Error(`No token found at ${sourceFile.fileName}:${position}`);
  }

  if (
    token.parent &&
    (isTypeAliasDeclaration(token.parent) ||
      isInterfaceDeclaration(token.parent))
  ) {
    return token.parent;
  }

  return getNearestTypeFromPosition(sourceFile, position - 1);
}

export function getNearestType(
  sourceFile: SourceFile,
  { line, character }: SelectionStart
): TypeAliasDeclaration | InterfaceDeclaration | null {
  return getNearestTypeFromPosition(
    sourceFile,
    getPositionOfLineAndCharacter(sourceFile, line, character)
  );
}
