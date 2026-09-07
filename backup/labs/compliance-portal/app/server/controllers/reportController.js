import { generatePdf } from "../reports/pdfGenerator.js";
import { generateCsv } from "../reports/csvGenerator.js";
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import reportsMockData from "../../src/mock/reports.json" with { type: "json" };

class ReportController {
  async getReports(req, res, next) {
    try {
      res.json(reportsMockData);
    } catch (err) {
      next(err);
    }
  }

  async generateReport(req, res, next) {
    try {
      const { name, type } = req.body;
      const reportName = name || "DPDP Compliance Report";
      const format = type || "PDF";

      await auditLogRepository.logEvent("Report Generated", `Successfully generated report "${reportName}" in ${format} format.`);

      res.json({
        success: true,
        message: `Report "${reportName}" generated successfully.`,
        downloadUrl: `/api/v1/reports/download/${reportName.toLowerCase().replace(/\s+/g, "_")}.${format.toLowerCase()}`
      });
    } catch (err) {
      next(err);
    }
  }

  async downloadReport(req, res, next) {
    try {
      const { id } = req.params; // e.g. dpdp_compliance_report.pdf
      const format = id.endsWith(".csv") ? "csv" : "pdf";
      
      let reportData;
      if (format === "csv") {
        reportData = await generateCsv("Report Download", {});
      } else {
        reportData = await generatePdf("Report Download", {});
      }

      res.setHeader("Content-Disposition", `attachment; filename=${id}`);
      res.setHeader("Content-Type", reportData.contentType);
      res.send(reportData.content);
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();
