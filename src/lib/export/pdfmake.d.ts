declare module 'pdfmake/build/pdfmake' {
	const pdfMake: {
		vfs: Record<string, string>;
		createPdf(docDefinition: any): {
			getBuffer(callback: (buffer: Uint8Array) => void): void;
			getBlob(callback: (blob: Blob) => void): void;
		};
	};
	export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
	const vfs: Record<string, string>;
	export default vfs;
}
