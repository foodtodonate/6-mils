// const DateTime = require('luxon').DateTime
// const isPlainObject = require('is-plain-obj')
// const merge = require('lodash.merge')
const request = require('got')
// const util = require('util')

const path = require('path')
const OutboundMessage = require('@6-mils/OutboundCxmlMessage')
const Libxml = require('node-libxml')
const libxml = new Libxml()

/**
 * A collection of private property values for each instance of this class.
 * @type {WeakMap}
 */
// eslint-disable-next-line no-unused-vars
const _private = new WeakMap()

function validateRequestBody (doc) {
  return new Promise((resolve, reject) => {
    try {
      const xmlIsWellFormed = libxml.loadXmlFromString(doc)
      if (!xmlIsWellFormed) {
        console.log(`\n\n==========\n\nXML IS MALFORMED!\n\n`)
        console.error(libxml.wellformedErrors)
        console.log(`\n\n==========\n\n`)
      }

      libxml.loadDtds([path.join(__dirname, 'node_modules/@6-mils/OutboundCxmlMessage/dtds/InvoiceDetail.dtd')])
      const xmlIsValid = libxml.validateAgainstDtds()
      if (!xmlIsValid) {
        console.log(`\n\n==========\n\nXML IS NOT VALID AGAINST DTD!\n\n`)
        console.error(libxml.validationDtdErrors)
        console.log('\n\n')
        console.info(doc)
        console.log(`\n\n==========\n\n`)
        return reject(new Error('InvoiceRequest does not match DTD'))
      } else {
        console.log('XML matched DTD')
      }

      resolve()
    } catch (ex) {
      console.error(ex.message || ex.code)
      reject(ex)
    }
  })
}

class InvoiceRequest extends OutboundMessage {
  // eslint-disable-next-line no-useless-constructor
  constructor (invoice) {
    invoice = invoice || {}
    super(OutboundMessage.MESSAGE_TYPES.InvoiceRequest, invoice)

    const props = {
      language: invoice.language,
      payloadId: invoice.payloadId,
      version: '1.2.014',
      timeStamp: invoice.timeStamp,
      header: {
        from: {
          domain: '',
          identity: ''
        },
        to: {
          domain: '',
          identity: ''
        },
        sender: {
          domain: '',
          identity: '',
          sharedSecret: '',
          userAgent: ''
        }
      },
      request: {
        deploymentMode: '',
        requestHeader: {
          invoiceDate: '',
          invoiceId: '',
          operation: '',
          purpose: '',
          isAccountingInLine: '',
          isTaxInLine: '',
          requester_email: '',
          requester_name: ''
        },
        invoiceDetailReq: {
          invoicePartner: {
            contact: [],
            idRefDomain: '',
            idRefIdentifier: ''
          },
          invoiceDetailShip: {
            contact: []
          },
          invoiceDetailOrder: {
            payloadId: '',
            item: {
              dist: [],
              list: [],
              tax: []
            }
          },
          invoiceDetailPaymentTerm: {
            percentRate: '',
            payInNumOfDays: ''
          },
          invoiceDetailSummary: {
            summary: {
              tax: [],
              total: []
            }
          }
        }
      }
    }
    _private.set(this, props)
  }

  get header () {
    return _private.get(this).header.sender
  }

  addContact (contact) {
    contact = contact || {}

    const props = _private.get(this)

    if (contact.role == null) {
      throw new Error('Contact object cannot have empty "role" property')
    }

    if (contact.name == null) {
      throw new Error('Contact object cannot have empty "name" property')
    }

    if (contact.language == null) {
      throw new Error('Contact object cannot have empty "language" property')
    }

    if (contact.street == null) {
      throw new Error('Contact object cannot have empty "street" property')
    }

    if (contact.city == null) {
      throw new Error('Contact object cannot have empty "city" property')
    }

    if (contact.state == null) {
      throw new Error('Contact object cannot have empty "state" property')
    }

    if (contact.country == null) {
      throw new Error('Contact object cannot have empty "country" property')
    }

    if (contact.role === 'shipTo' || contact.role === 'shipFrom') {
      props.request.invoiceDetailReq.invoiceDetailShip.contact.push(contact)
    } else props.request.invoiceDetailReq.invoicePartner.contact.push(contact)
  }

  /**
   *  Add single distribution information to invoice
   *
   * @param {object} dist - An item object containing all the properties listed below
   */
  addDistribution (dist) {
    dist = dist || {}

    // Validate dist
    if (dist.dist_amt == null || isNaN(dist.dist_amt)) {
      throw new Error('Distribution must have dist_amt, and must be a number')
    }

    if (dist.dist_currency == null) {
      throw new Error('Distribution must have dist_currency.')
    }

    if (dist.dist_name == null) {
      throw new Error('Distribution must have dist_name.')
    }

    if (dist.dist_seg1 == null) {
      throw new Error('Distribution must have dist_seg1.')
    }

    if (dist.dist_seg1_desc == null) {
      throw new Error('Distribution must have dist_seg1_desc.')
    }

    if (dist.dist_seg1_desclang == null) {
      throw new Error('Distribution must have dist_seg1_desclang.')
    }

    if (dist.dist_seg1_name == null) {
      throw new Error('Distribution must have dist_seg1_name.')
    }

    if (dist.dist_seg1_namelang == null) {
      throw new Error('Distribution must have dist_seg1_namelang.')
    }

    if (dist.dist_seg2 == null) {
      throw new Error('Distribution must have dist_seg2.')
    }

    if (dist.dist_seg2_desc == null) {
      throw new Error('Distribution must have dist_seg2_desc.')
    }

    if (dist.dist_seg2_desclang == null) {
      throw new Error('Distribution must have dist_seg2_desclang.')
    }

    if (dist.dist_seg2_name == null) {
      throw new Error('Distribution must have dist_seg2_name.')
    }

    if (dist.dist_seg2_namelang == null) {
      throw new Error('Distribution must have dist_seg2_namelang.')
    }

    const props = _private.get(this)

    props.request.invoiceDetailReq.invoiceDetailOrder.item.dist.push(dist)

    _private.set(this, props)
  }

  /**
   *  Add single item to invoice
   *
   * @param {object} item - An item object containing all the properties listed below
   * @param {number} lineNumber - A number used for tracking multiple line items in a series,
   * is not necessary as will auto set to 1 for singles
   *
   */
  addItem (item, lineNumber) {
    item = item || {}

    // Validate input
    if (item.PartDescription == null) {
      throw new Error('All items must have a PartDescription')
    }

    if (item.PartDescription_language == null) {
      throw new Error('All items must have a PartDescription_language')
    }

    if (item.PartId == null) {
      throw new Error('All items must have a PartId')
    }

    if (item.Subtotal == null || isNaN(item.Subtotal)) {
      throw new Error('All items must have a Subtotal, and Subtoal must be a number')
    }

    if (item.UOM == null) {
      throw new Error('All items must have a PartDescription')
    }

    if (item.UnitPrice_money == null || isNaN(item.UnitPrice_money)) {
      throw new Error('All items must have a UnitPrice_money, and UnitPrice_money must be a number')
    }

    if (item.UnitPtice_currency == null) {
      throw new Error('All items must have a UnitPtice_currency')
    }

    if (item.gross_amt == null || isNaN(item.gross_amt)) {
      throw new Error('All items must have a gross_amt')
    }

    if (item.gross_amt_currency == null) {
      throw new Error('All items must have a gross_amt_currency')
    }

    if (item.invoice_id == null) {
      throw new Error('All items must have a invoice_id')
    }

    if (item.net_amt == null || isNaN(item.net_amt)) {
      throw new Error('All items must have a net_amt, and net_amt must be a number')
    }

    if (item.net_amt_currency == null) {
      throw new Error('All items must have a net_amt_currency')
    }

    if (item.quantity == null || isNaN(item.quantity)) {
      throw new Error('All items must have a quantity, and must be a number')
    }

    if (item.tax_amt == null || isNaN(item.tax_amt)) {
      throw new Error('All items must have a tax_amt, and must be a number')
    }

    if (item.tax_currency == null) {
      throw new Error('All items must have a tax_currency')
    }

    if (item.tax_desc == null) {
      throw new Error('All items must have a tax_desc')
    }

    if (item.tax_desc_language == null) {
      throw new Error('All items must have a tax_desc_language')
    }

    const props = _private.get(this)

    props.request.invoiceDetailReq.invoiceDetailOrder.item.list.push(item)

    _private.set(this, props)
  }

  /**
   * Adds multiple items to the Invoice
   *
   * @param {Array} items - A list of items
   *
   * @return this
   */
  addItems (items) {
    if (!Array.isArray(items)) {
      throw new Error('This is not an array')
    }
    // eslint-disable-next-line no-unused-vars
    let lineNumber = 1

    items.forEach((item) => {
      lineNumber++
      this.addItem(item, lineNumber)
    })
  }

  /**
   * Adds tax for each line item
   *
   * @param {Object} itemTax - A tax object corresponding to the list of items.
   * Array of items must be added already.
   *
   * @return this
   */
  addItemTax (itemTax) {
    itemTax = itemTax || {}
    const props = _private.get(this)

    if (!props.request.invoiceDetailReq.invoiceDetailOrder.item.list.length) {
      throw new Error('Must have a list of items added to correspond to the incoming taxes')
    }

    if (itemTax.category == null) {
      throw new Error('Tax object must contain property "category", and must not be empty')
    }

    if (itemTax.invoice_id == null) {
      throw new Error('Tax object must contain property "invoice_id", and must not be empty')
    }

    if (itemTax.percent_rate == null || isNaN(itemTax.percent_rate)) {
      throw new Error('Tax object must contain property "percent_rate", must not be empty, and must be a number')
    }

    if (itemTax.purpose == null) {
      throw new Error('Tax object must contain property "purpose", and must not be empty')
    }

    if (itemTax.tax_amt == null || isNaN(itemTax.tax_amt)) {
      throw new Error('Tax object must contain property "tax_amt", must not be empty, and must be a number')
    }

    if (itemTax.tax_desc == null) {
      throw new Error('Tax object must contain property "tax_desc", and must not be empty')
    }

    if (itemTax.tax_desc_lang == null) {
      throw new Error('Tax object must contain property "tax_desc_lang", and must not be empty')
    }

    if (itemTax.tax_location == null) {
      throw new Error('Tax object must contain property "tax_location", and must not be empty')
    }

    if (itemTax.tax_location_lang == null) {
      throw new Error('Tax object must contain property "sales", and must not be empty')
    }

    if (itemTax.taxable_amt == null || isNaN(itemTax.taxable_amt)) {
      throw new Error('Tax object must contain property "taxable_amt", and must not be empty')
    }

    if (itemTax.taxable_currency == null) {
      throw new Error('Tax object must contain property "taxable_currency", and must not be empty')
    }

    props.request.invoiceDetailReq.invoiceDetailOrder.item.tax.push(itemTax)

    _private.set(this, props)
  }

  /**
   * Adds the overall summary for the invoice, excluding the tax summary
   *
   * @param {Object} summary - A object detailing the overall summary of the invoice
   *
   * @return this
   */
  addSummary (summary) {
    summary = summary || {}

    const props = _private.get(this)

    if (summary.due_amt == null || isNaN(summary.due_amt)) {
      throw new Error('Summary object must contain property "due_amt", must not be empty, and must be a number')
    }

    if (summary.due_currency == null) {
      throw new Error('Summary object must contain property "due_currency", and must not be empty')
    }

    if (summary.gross_amt == null || isNaN(summary.gross_amt)) {
      throw new Error('Summary object must contain property "gross_amt", must not be empty, and must be a number')
    }

    if (summary.gross_currency == null) {
      throw new Error('Summary object must contain property "gross_currency", and must not be empty')
    }

    if (summary.invoice_id == null) {
      throw new Error('Summary object must contain property "invoice_id", and must not be empty')
    }

    if (summary.net_amt == null || isNaN(summary.net_amt)) {
      throw new Error('Summary object must contain property "net_amt", must not be empty, and must be a number')
    }

    if (summary.net_currency == null) {
      throw new Error('Summary object must contain property "net_currency", and must not be empty')
    }

    if (summary.shipping_Currency == null) {
      throw new Error('Summary object must contain property "shipping_Currency", and must not be empty')
    }

    if (summary.shipping_amt == null || isNaN(summary.shipping_amt)) {
      throw new Error('Summary object must contain property "shipping_amt", must not be empty, and must be a number')
    }

    if (summary.sub_total_amt == null || isNaN(summary.sub_total_amt)) {
      throw new Error('Summary object must contain property "sub_total_amt", must not be empty, and must be a number')
    }

    if (summary.sub_total_currency == null) {
      throw new Error('Summary object must contain property "sub_total_currency", and must not be empty')
    }

    if (summary.tax_desc == null) {
      throw new Error('Summary object must contain property "tax_desc", and must not be empty')
    }

    if (summary.tax_desc_lang == null) {
      throw new Error('Summary object must contain property "tax_desc_lang", and must not be empty')
    }

    props.request.invoiceDetailReq.invoiceDetailSummary.summary.total.push(summary)

    _private.set(this, props)
  }

  /**
   * Adds the summary of the tax only
   *
   * @param {object} summaryTax - An object containing all the details for the tax summary
   *
   * @return this
   */
  addSummaryTax (summaryTax) {
    summaryTax = summaryTax || {}

    const props = _private.get(this)

    if (summaryTax.category == null) {
      throw new Error('Summary object must contain property "due_amt", and must not be empty.')
    }

    if (summaryTax.invoice_id == null) {
      throw new Error('Summary object must contain property "invoice_id", and must not be empty.')
    }

    if (summaryTax.percent_rate == null || isNaN(summaryTax.percent_rate)) {
      throw new Error('Summary object must contain property "percent_rate", must not be empty, and must be a number')
    }

    if (summaryTax.purpose == null) {
      throw new Error('Summary object must contain property "purpose", and must not be empty.')
    }

    if (summaryTax.tax_amt == null || isNaN(summaryTax.tax_amt)) {
      throw new Error('Summary object must contain property "tax_amt", must not be empty, and must be a number')
    }

    if (summaryTax.tax_desc == null) {
      throw new Error('Summary object must contain property "tax_desc", and must not be empty.')
    }

    if (summaryTax.tax_desc_lang == null) {
      throw new Error('Summary object must contain property "tax_desc_lang", and must not be empty.')
    }

    if (summaryTax.tax_location == null) {
      throw new Error('Summary object must contain property "tax_location", and must not be empty.')
    }

    if (summaryTax.tax_location_lang == null) {
      throw new Error('Summary object must contain property "tax_location_lang", and must not be empty.')
    }

    if (summaryTax.taxable_amt == null || isNaN(summaryTax.taxable_amt)) {
      throw new Error('Summary object must contain property "taxable_amt", must not be empty, and must be a number')
    }

    if (summaryTax.taxable_currency == null) {
      throw new Error('Summary object must contain property "taxable_currency", and must not be empty.')
    }

    props.request.invoiceDetailReq.invoiceDetailSummary.summary.tax.push(summaryTax)

    _private.set(this, props)
  }

  /**
   * Sets header for the invoice.
   *
   * @param{object} header Plain object containing a from, to, and sender key
   *
   * @return {undefined}
   */
  setHeader (header) {
    header = header || {}

    // eslint-disable-next-line no-unused-vars
    const props = _private.get(this)

    if (header.to == null) {
      throw new Error('When creating an invoice, "to" is required')
    }
    if (header.from == null) {
      throw new Error('When creating an invoice, "from" is required')
    }
    if (header.sender == null) {
      throw new Error('When creating an invoice, "sender" is required')
    }
    props.header.sender = header.sender
    props.header.from = header.from
    props.header.to = header.to
    this.setSenderInfo(this.header)
    this.setSupplierInfo(this.header)
    this.setBuyerInfo(this.header)
    _private.set(this, props)
    return props
  }

  /**
   * Sets the RequestHeader properties
   *
   * @param {object} header - Plain object containing "invoiceDate", "invoiceId", "operation", and "purpose"
   *
   * @return this
   */
  setRequestHeader (header) {
    header = header || {}

    const props = _private.get(this)

    if (header.invoiceDate == null) {
      throw new Error('The Request Header property "invoiceDate" must not be blank')
    }

    if (header.invoiceId == null) {
      throw new Error('The Request Header property "invoiceId" must not be blank')
    }

    if (header.operation == null) {
      throw new Error('The Request Header property "operation" must not be blank')
    }

    if (header.purpose == null) {
      throw new Error('The Request Header property "purpose" must not be blank')
    }

    props.request.deploymentMode = header.deploymentMode
    props.request.requestHeader.invoiceDate = header.invoiceDate
    props.request.requestHeader.invoiceId = header.invoiceId
    props.request.requestHeader.operation = header.operation
    props.request.requestHeader.purpose = header.purpose
    props.request.requestHeader.isTaxInLine = header.isTaxInLine
    props.request.requestHeader.isAccountingInLine = header.isAccountingInLine
    props.request.requestHeader.requester_email = header.requester_email
    props.request.requestHeader.requester_name = header.requester_name
    props.request.invoiceDetailReq.invoiceDetailOrder.payloadId = header.payloadId
    props.request.invoiceDetailReq.invoiceDetailPaymentTerm.percentRate = header.percentRate
    props.request.invoiceDetailReq.invoiceDetailPaymentTerm.payInNumOfDays = header.payInNumOfDays
    props.request.invoiceDetailReq.invoiceDetailPaymentTerm.payInNumOfDays = header.payInNumOfDays
    _private.set(this, props)

    return this
  }

  /**
   * Returns the parsed cXML
   *
   * @return {String}
   */
  render () {
    return this._renderCxml(_private.get(this), true)
  }

  /**
   * Sends the cXML Invoice message to the specified server.
   *
   * @param  {String}   url     The address to send the cXML message to.
   *
   * @param  {Object}   props   A collection of private properties held by the
   *                            sub-class instance.
   *
   * @return {Promise}
   */
  submitInvoice (url, props) {
    /**
     * This reference is needed to emit the "received" event from within the
     * Promise.
     */
    const self = this

    /**
     * The provided URL, parsed as an object. This is necessary because
     * otherwise `got` will not pay any attention to embedded port numbers.
     * @type {URL}
     */
    const parsedUrl = new URL(url)

    /**
     * Update timestamp. This should only be done immediately before the message
     * is sent.
     */
    const baseProps = _private.get(self)

    _private.set(self, baseProps)

    const requestBody = self.render()

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        await validateRequestBody(requestBody)
        self.emit('sending', requestBody)

        const response = await request.post(
          parsedUrl,
          {
            body: requestBody,
            headers: {
              'content-type': 'application/xml',
              'user-agent': baseProps.header.sender.userAgent
            },
            timeout: baseProps.requestTimeout
          }
        )

        self.emit('received', response.body)
        // console.log(util.inspect(response, true, 999))
        if (response.body.length === 0) {
          resolve('%%EMPTY%%')
        }

        resolve(response)
      } catch (ex) {
        reject(ex)
      }
    })
  }
}

module.exports = InvoiceRequest
