const debug = require('debug')('6-mils:OrderRequest')

const DateTime = require('luxon').DateTime
const isPlainObject = require('is-plain-obj')
const merge = require('lodash.merge')

const OutboundMessage = require('@6-mils/OutboundCxmlMessage')
const OrderResponse = require('./OrderResponse.js')

/**
 * A collection of private property values for each instance of this class.
 * @type {WeakMap}
 */
const _private = new WeakMap()

class OrderRequest extends OutboundMessage {
  /**
   * Options:
   *
   * {String}    orderId     The unique identifier for the purchase order
   *                         represented by this cXML message.
   *
   * {String?}   orderDate
   */
  constructor (options) {
    options = options || {}
    options.orderId = options.orderId || ''
    options.orderDate = options.orderDate || new Date()

    debug('Constructing new message from options %o', options)
    // Validate option values
    if (!options.orderId) {
      throw new Error('The "orderId" property of the "options" parameter is required and must not be blank.')
    }

    super(OutboundMessage.MESSAGE_TYPES.OrderRequest, options)

    const props = {
      language: 'en',
      id: options.orderId.toString(),
      date: (typeof options.orderDate === 'string' ? options.orderDate : DateTime.fromJSDate(options.orderDate).toString()),
      orderType: 'regular',
      requestType: 'new',
      items: []
    }

    _private.set(this, props)
  }

  get orderId () {
    return _private.get(this).id
  }

  get orderDate () {
    return _private.get(this).date
  }

  get orderType () {
    return _private.get(this).orderType
  }

  get requestType () {
    return _private.get(this).requestType
  }

  /**
   * Adds a line item to this purchase order.
   *
   * @param {Object}   item   A plain object containing the keys "name",
   *                          "quantity", "supplierPartId", "unitPrice", and
   *                          "uom".
   *
   * @return {undefined}
   */
  addItem (item) {
    item = item || {}

    // Validate input
    if (item.name == null) {
      throw new Error('When adding an item to the order, "name" is a required property for "item".')
    }

    if (item.quantity == null || isNaN(item.quantity * 1)) {
      throw new Error('When adding an item to the order, "quantity" is a required property for "item", and must be numeric.')
    }

    if (item.supplierPartId == null) {
      throw new Error('When adding an item to the order, "supplierPartId" is a required property for "item".')
    }

    if (item.unitPrice == null || isNaN(item.unitPrice * 1)) {
      throw new Error('When adding an item to the order, "unitPrice" is a required property for "item", and must be numeric.')
    }

    if (!item.currency) {
      throw new Error('When adding an item to the order, "currency" is a required property for "item", and must not be blank.')
    }

    if (item.uom == null) {
      throw new Error('When adding an item to the order, "uom" is a required property for "item".')
    }

    if (item.classification == null) {
      throw new Error('When adding an item to the order, "classification" is a required property for "item", and must not be empty.')
    } else if (!isPlainObject(item.classification) || Object.keys(item.classification).length === 0) {
      throw new Error('When adding an item to the order, "classification" is a required property for "item", and must not be empty.')
    }

    const props = _private.get(this)
    const lineNumber = props.items.length + 1

    debug('Adding item to order #%s (line %d): %o', props.id, lineNumber, item)

    props.items.push(merge({ lineNumber: lineNumber }, item))

    _private.set(this, props)
  }

  /**
   * Adds multiple line items to this purchase order.
   *
   * @param {Array}   items   A list of items following the same requirements
   *                          for "addItem".
   *
   * @return this
   */
  addItems (items) {
    if (!Array.isArray(items)) {
      throw new Error('The "items" parameter is required and must be an instance of Array.')
    }

    items.forEach((item) => this.addItem(item))

    return this
  }

  /**
   * Sets the bill-to address, purchasing card info, and tax.
   *
   * @param {Object}   options
   *
   * @return this
   */
  setBillingInfo (options) {
    options = options || {}

    const props = _private.get(this)
    props.billTo = props.billTo || {}
    props.order = props.order || {}

    // Input validation
    if (options.address == null) {
      throw new Error('The "options" parameter is required and must at least contain the "address" property.')
    }

    if (!options.address.companyName) {
      throw new Error('The bill-to address must at least contain the "companyName" property, which must not be blank.')
    }

    props.billTo.address = merge({}, options.address) // this avoids any chance of modifying the input value

    if (options.email) {
      if (!options.email.address) {
        throw new Error('The bill-to e-mail must at least contain the "address" property, which must not be blank.')
      }

      props.billTo.email = merge({ nickname: 'default' }, options.email)
    }

    if (options.phone) {
      if (!options.phone.countryCode || !options.phone.areaOrCityCode || !options.phone.number) {
        throw new Error('The bill-to phone must at least contain the "countryCode", "areaOrCityCode", and "number" properties, which must not be blank.')
      }

      props.billTo.phone = merge({ nickname: 'default' }, options.phone) // this avoids any chance of modifying the input value
    }

    if (options.pcard) {
      props.order.pcard = {}

      if (!options.pcard.number || !options.pcard.expiration) {
        throw new Error('The bill-to purchasing card must contain the "number" and "expiration" properties, which must not be blank. "expiration" must be either a string in ISO 8601 format, or an instance of {Date}.')
      }

      props.order.pcard.acct = options.pcard.number

      if (typeof options.pcard.expiration !== 'string' && !(options.pcard.expiration instanceof Date)) {
        throw new Error('The bill-to purchasing card must contain the "number" and "expiration" properties, which must not be blank. "expiration" must be either a string in ISO 8601 format, or an instance of {Date}.')
      }

      if (typeof options.pcard.expiration === 'string') {
        const parsedDate = DateTime.fromISO(options.pcard.expiration)

        if (!parsedDate.isValid) {
          throw new Error('The bill-to purchasing card must contain the "number" and "expiration" properties, which must not be blank. "expiration" must be either a string in ISO 8601 format, or an instance of {Date}.')
        }

        props.order.pcard.exp = parsedDate.endOf('month').toString().substring(0, 10)
      } else {
        props.order.pcard.exp = DateTime.fromJSDate(options.pcard.expiration).endOf('month').toString().substring(0, 10)
      }
    }

    if (options.tax) {
      if (options.tax.amount == null || isNaN(options.tax.amount * 1)) {
        throw new Error('The bill-to tax information must contain the "amount" property, which must have a numeric value.')
      }

      if (!options.tax.currency) {
        throw new Error('The bill-to tax information must contain the "currency" property, which must not be blank.')
      }

      props.order.tax = merge({}, options.tax) // this avoids any chance of modifying the input value
    }

    _private.set(this, props)
  }

  /**
   * Sets the ship-to address and shipping method.
   *
   * @param {Object}   options
   *
   * @return this
   */
  setShippingInfo (options) {
    options = options || {}

    const props = _private.get(this)
    props.shipTo = props.shipTo || {}
    props.order = props.order || {}

    // Input validation
    if (options.address == null) {
      throw new Error('The "options" parameter is required and must at least contain the "address" property.')
    }

    if (!options.address.companyName || !options.address.attentionOf) {
      throw new Error('The ship-to address must at least contain the "companyName" and "attentionOf" properties, which must not be blank.')
    }

    props.shipTo.address = merge({ attn: [], nickname: 'default' }, options.address) // this avoids any chance of modifying the input value

    if (Array.isArray(options.address.attentionOf)) {
      if (options.address.attentionOf.length === 0) {
        throw new Error('The ship-to address must at least contain the "companyName" and "attentionOf" properties, which must not be blank.')
      }

      const summation = options.address.attentionOf.reduce((a, b) => { return a + b })
      if (summation.length === 0) {
        throw new Error('The ship-to address must at least contain the "companyName" and "attentionOf" properties, which must not be blank.')
      }

      options.address.attentionOf.forEach((line) => { props.shipTo.address.attn.push(line) })
    } else {
      props.shipTo.address.attn.push(options.address.attentionOf)
    }

    if (options.email) {
      if (!options.email.address) {
        throw new Error('The ship-to e-mail must at least contain the "address" property, which must not be blank.')
      }

      props.shipTo.email = merge({ nickname: 'default' }, options.email)
    }

    if (options.phone) {
      if (!options.phone.countryCode || !options.phone.areaOrCityCode || !options.phone.number) {
        throw new Error('The ship-to phone must at least contain the "countryCode", "areaOrCityCode", and "number" properties, which must not be blank.')
      }

      props.shipTo.phone = merge({ nickname: 'default' }, options.phone)
    }

    if (options.method) {
      if (options.method.amount == null || isNaN(options.method.amount * 1)) {
        throw new Error('The ship-to method must contain the "amount" property, which must have a numeric value.')
      }

      props.order.shipping = merge({}, options.method)
    }

    _private.set(this, props)
  }

  /**
   * Sets the total cost of the order. Only necessary if the items are of mixed
   * currencies (otherwise, the total will be calculated automatically).
   *
   * @param {Object}   options
   *
   * @return this
   */
  setTotal (options) {
    options = options || {}

    const props = _private.get(this)

    // Input validation
    if (options.amount == null || isNaN(options.amount * 1)) {
      throw new Error('The total must contain the "amount" property, which must have a numeric value.')
    }

    if (!options.currency) {
      throw new Error('The total must contain the "currency" property, which must not be blank.')
    }

    props.total = merge({}, options) // this avoids any chance of modifying the input value

    _private.set(this, props)
  }

  /**
   * Returns the raw cXML of the underlying OrderRequest message.
   *
   * @param  {Object?}   options   An optional dictionary that may contain a
   *                               single optional key: `format`. If that key
   *                               has a truthy value, the output will be
   *                               formatted to be more human-readable.
   *
   * @return {String}
   */
  toString (options) {
    options = (options || {})
    return this._renderCxml(_private.get(this), options.format)
  }

  /**
   * Submits the OrderReq to the supplier's site.
   *
   * @param  {String}   url   The URL that the XML will be POSTed to. If the
   *                          value '%%TEST%%' is provided, no actual HTTP
   *                          request will take place.
   *
   * @return {Promise}        Fulfilled with an instance of {OrderResponse}, or
   *                          rejected if there is a problem with the underlying
   *                          HTTP transmission.
   */
  async submit (url) {
    url = (url || '')

    if (url.length === 0 || typeof url !== 'string') {
      throw new Error('The "url" parameter is required and must not be a non-empty string.')
    }

    const props = _private.get(this)

    props.total = props.total || {}

    if (props.total.amount == null) {
      let totalCost = 0
      let currency = ''

      props.items.forEach((item) => {
        if (!currency) {
          currency = item.currency
        } else {
          if (item.currency !== currency) {
            throw new Error('Before submitting the order, "setTotal" must be called if all of the items in the order do not have the same currency.')
          }
        }

        totalCost += (item.quantity * item.unitPrice)
      })

      props.total = {
        amount: totalCost,
        currency: currency
      }
    }

    if (url === '%%TEST%%') {
      return new OrderResponse(this._getGenericResponse())
    }

    return new OrderResponse(await this._submitCxml(url, props))
  }
}

module.exports = OrderRequest
