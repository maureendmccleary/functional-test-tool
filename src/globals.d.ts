/**
 * Ambient declarations for browser APIs and CDN globals.
 *
 * `docx` is loaded from unpkg by a plain <script> tag in index.html, so it has
 * no types here. Bundling it (`npm i docx@8.5.0`) would retire this.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const docx: any;

interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
}

interface FilePickerOptions {
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
    startIn?: string;
}

interface FileSystemWritableFileStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
}

interface FileSystemFileHandleLike {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
}

interface Window {
    showOpenFilePicker(options?: FilePickerOptions): Promise<FileSystemFileHandleLike[]>;
    showSaveFilePicker(options?: FilePickerOptions): Promise<FileSystemFileHandleLike>;
}
