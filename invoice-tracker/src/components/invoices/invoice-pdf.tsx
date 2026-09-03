import { renderToBuffer } from "@react-pdf/renderer";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { InvoiceDocumentModel } from "@/lib/invoice/document";

Font.registerHyphenationCallback((word) => [word]);

const colors = {
  ink: "#2a241c",
  muted: "#6f675c",
  line: "#ddd6cc",
};

const styles = StyleSheet.create({
  page: {
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.45,
    paddingBottom: 56,
    paddingHorizontal: 48,
    paddingTop: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
  },
  businessName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  muted: {
    color: colors.muted,
  },
  invoiceKicker: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.6,
    textAlign: "right",
    textTransform: "uppercase",
  },
  invoiceNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    marginTop: 4,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "flex-end",
    marginTop: 10,
  },
  metaItem: {
    minWidth: 88,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  rule: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginVertical: 22,
  },
  sectionLabel: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  tableHeader: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 6,
  },
  tableHeaderText: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    borderBottomColor: colors.line,
    borderBottomWidth: 0.5,
    flexDirection: "row",
    paddingVertical: 8,
  },
  description: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingRight: 12,
  },
  qty: {
    width: 48,
    textAlign: "right",
  },
  money: {
    width: 84,
    textAlign: "right",
  },
  totals: {
    alignSelf: "flex-end",
    marginTop: 16,
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandTotal: {
    borderTopColor: colors.ink,
    borderTopWidth: 1,
    flexDirection: "row",
    fontFamily: "Helvetica-Bold",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
  },
  notes: {
    marginTop: 28,
  },
  notesBody: {
    color: colors.muted,
    marginTop: 6,
  },
  footer: {
    bottom: 28,
    color: colors.muted,
    fontSize: 8,
    left: 48,
    position: "absolute",
    right: 48,
    textAlign: "center",
  },
});

export function InvoicePdfDocument({
  document,
}: {
  document: InvoiceDocumentModel;
}) {
  return (
    <Document
      title={document.invoiceNumber}
      author={document.businessName}
      subject={`Invoice ${document.invoiceNumber}`}
      language="en-CA"
    >
      <Page size="LETTER" wrap style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexGrow: 1, flexShrink: 1, paddingRight: 16 }}>
            <Text style={styles.businessName}>{document.businessName}</Text>
            {document.businessAddress.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
            <Text style={styles.muted}>{document.businessEmail}</Text>
            {document.businessPhone ? (
              <Text style={styles.muted}>{document.businessPhone}</Text>
            ) : null}
            {document.gstRegistration ? (
              <Text style={styles.muted}>GST {document.gstRegistration}</Text>
            ) : null}
            {document.qstRegistration ? (
              <Text style={styles.muted}>QST {document.qstRegistration}</Text>
            ) : null}
            {document.taxRegistration && !document.gstRegistration && !document.qstRegistration ? (
              <Text style={styles.muted}>Tax ID {document.taxRegistration}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.invoiceKicker}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{document.invoiceNumber}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Issued</Text>
                <Text>{document.issueDateLabel}</Text>
              </View>
              {document.dueDateLabel ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Due</Text>
                  <Text>{document.dueDateLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.rule} />

        <Text style={styles.sectionLabel}>Bill to</Text>
        <Text>{document.clientName}</Text>
        {document.clientCompany ? (
          <Text style={styles.muted}>{document.clientCompany}</Text>
        ) : null}
        {document.clientAddress.map((line) => (
          <Text key={line} style={styles.muted}>
            {line}
          </Text>
        ))}
        <Text style={styles.muted}>{document.clientEmail}</Text>

        <View style={styles.rule} />

        <View style={styles.tableHeader} wrap={false}>
          <Text style={[styles.tableHeaderText, styles.description]}>
            Description
          </Text>
          <Text style={[styles.tableHeaderText, styles.qty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.money]}>Rate</Text>
          <Text style={[styles.tableHeaderText, styles.money]}>Amount</Text>
        </View>

        {document.items.length === 0 ? (
          <View style={styles.row}>
            <Text style={styles.muted}>No line items</Text>
          </View>
        ) : (
          document.items.map((item, index) => (
            <View key={`${item.description}-${index}`} style={styles.row}>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.qty}>{item.quantityLabel}</Text>
              <Text style={styles.money}>{item.rateLabel}</Text>
              <Text style={styles.money}>{item.amountLabel}</Text>
            </View>
          ))
        )}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{document.subtotalLabel}</Text>
          </View>
          {document.discountLabel ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Discount</Text>
              <Text>{document.discountLabel}</Text>
            </View>
          ) : null}
          {document.taxLines.map((line) => (
            <View key={line.label} style={styles.totalRow}>
              <Text style={styles.muted}>{line.label}</Text>
              <Text>{line.amountLabel}</Text>
            </View>
          ))}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{document.totalLabel}</Text>
          </View>
        </View>

        {document.notes ? (
          <View style={styles.notes} wrap={false}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notesBody}>{document.notes}</Text>
          </View>
        ) : null}

        {document.paymentInstructions ? (
          <View style={styles.notes} wrap={false}>
            <Text style={styles.sectionLabel}>Payment instructions</Text>
            <Text style={styles.notesBody}>{document.paymentInstructions}</Text>
          </View>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${document.invoiceNumber}  ·  ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(document: InvoiceDocumentModel) {
  return renderToBuffer(<InvoicePdfDocument document={document} />);
}
