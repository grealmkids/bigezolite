import { Injectable } from '@angular/core';
import { MarksService } from './marks.service';
import JSZip from 'jszip';
import { lastValueFrom } from 'rxjs'; // Use promise-based approach for sequential processing

export interface BulkProgress {
    processedCount: number;
    totalCount: number;
    percent: number;
    currentStudent: string;
}

@Injectable({
    providedIn: 'root'
})
export class BulkReportService {

    constructor(private marksService: MarksService) { }

    /**
     * Generates reports for a list of students sequentially and returns a ZIP file.
     * Emits progress updates via the progressCallback.
     */
    async generateBulkReportsAndZip(
        examSetId: number,
        students: { student_id: number; student_name: string }[],
        year: number,
        classLevel: string,
        onProgress: (progress: BulkProgress) => void
    ): Promise<Blob> {

        const zip = new JSZip();
        const folderName = `${classLevel}_Reports_${year}`.replace(/[^a-z0-9-_]/gi, '_');
        const folder = zip.folder(folderName);

        let processed = 0;
        const total = students.length;

        for (const student of students) {
            // Notify Start of Student
            onProgress({
                processedCount: processed,
                totalCount: total,
                percent: Math.round((processed / total) * 100),
                currentStudent: student.student_name
            });

            try {
                // Fetch PDF (Single Responsibility: MarksService handles fetching)
                const pdfBlob = await lastValueFrom(this.marksService.generateStudentReportPDF(examSetId, student.student_id));

                if (pdfBlob && folder) {
                    const safeName = student.student_name.replace(/[^a-z0-9]/gi, '_');
                    folder.file(`${safeName}.pdf`, pdfBlob);
                }
            } catch (error) {
                console.error(`Failed to generate report for ${student.student_name}`, error);
                // We continue even if one fails, maybe log it to a "failed.txt" in the zip appropriately?
                if (folder) {
                    folder.file(`FAILED_${student.student_name}.txt`, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            processed++;

            // Notify Completion of Student
            onProgress({
                processedCount: processed,
                totalCount: total,
                percent: Math.round((processed / total) * 100),
                currentStudent: student.student_name
            });
        }

        // Finalizing
        onProgress({
            processedCount: total,
            totalCount: total,
            percent: 100,
            currentStudent: 'Compressing files...'
        });

        return await zip.generateAsync({ type: 'blob' });
    }
}
