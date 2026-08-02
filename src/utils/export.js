import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Export timetable as PNG image
 */
export async function exportAsPNG(elementId, filename = 'timetable') {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Export timetable as PDF
 */
export async function exportAsPDF(elementId, filename = 'timetable') {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // Use landscape if wider than tall
  const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
  const pdf = new jsPDF(orientation, 'mm', 'a4');

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const ratio = Math.min(
    (pdfWidth - 20) / imgWidth,
    (pdfHeight - 20) / imgHeight
  );

  const finalWidth = imgWidth * ratio;
  const finalHeight = imgHeight * ratio;

  const x = (pdfWidth - finalWidth) / 2;
  const y = 10;

  pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
  pdf.save(`${filename}.pdf`);
}

/**
 * Export timetable data as CSV
 */
export function exportAsCSV(schedule, config, sectionName, filename = 'timetable') {
  const workingDays = config.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periodsPerDay = config.periodsPerDay || 7;
  const periods = config.periods || [];

  let csv = `${sectionName} Timetable\n\n`;

  // Header
  csv += 'Day/Period';
  for (let p = 1; p <= periodsPerDay; p++) {
    const period = periods[p - 1];
    const timing = period ? `(${period.startTime}-${period.endTime})` : '';
    csv += `,Period ${p} ${timing}`;
  }
  csv += '\n';

  // Data rows
  for (const day of workingDays) {
    csv += day;
    for (let p = 1; p <= periodsPerDay; p++) {
      const slot = schedule[day]?.[p];
      if (slot && !slot.isLabContinuation) {
        csv += `,"${slot.subjectCode} (${slot.facultyShort || slot.faculty})"`;
      } else if (slot?.isLabContinuation) {
        csv += ',"(cont.)"';
      } else {
        csv += ',';
      }
    }
    csv += '\n';
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}
