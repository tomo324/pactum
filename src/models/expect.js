const assert = require('assert');
const jqy = require('json-query');
const djv = require('djv');

const Compare = require('../helpers/compare');
const handler = require('../exports/handler');

class Expect {

  constructor() {
    this.statusCode = null;
    this.body = null;
    this.bodyContains = [];
    this.json = [];
    this.jsonLike = [];
    this.jsonQuery = [];
    this.jsonQueryLike = [];
    this.jsonSchema = [];
    this.headers = [];
    this.headerContains = [];
    this.responseTime = null;
    this.customExpectHandlers = [];
  }

  validate(request, response) {
    this._validateStatus(response);
    this._validateHeaders(response);
    this._validateHeaderContains(response);
    this._validateBody(response);
    this._validateBodyContains(response);
    this._validateJson(response);
    this._validateJsonLike(response);
    this._validateJsonQuery(response);
    this._validateJsonQueryLike(response);
    this._validateJsonSchema(response);
    this._validateResponseTime(response);
    this._validateCustomExpectHandlers(request, response);
  }

  validateInteractions(interactions) {
    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];
      if (!interaction.exercised) {
        this.fail(`Interaction not exercised: ${interaction.withRequest.method} - ${interaction.withRequest.path}`);
      }
    }
  }

  _validateStatus(response) {
    if (this.statusCode !== null) {
      assert.strictEqual(response.statusCode, this.statusCode, `HTTP status ${response.statusCode} !== ${this.statusCode}`);
    }
  }

  _validateHeaders(response) {
    for (let i = 0; i < this.headers.length; i++) {
      const expectedHeaderObject = this.headers[i];
      const expectedHeader = expectedHeaderObject.key;
      const expectedHeaderValue = expectedHeaderObject.value;
      if (!response.headers[expectedHeader]) {
        this.fail(`Header '${expectedHeader}' not present in HTTP response`);
      }
      if (expectedHeaderValue !== undefined) {
        const actualHeaderValue = response.headers[expectedHeader];
        if (expectedHeaderValue instanceof RegExp) {
          if (!expectedHeaderValue.test(actualHeaderValue)) {
            this.fail(`Header regex (${expectedHeaderValue}) did not match for header '${expectedHeader}': '${actualHeaderValue}'`);
          }
        } else {
          if (expectedHeaderValue.toLowerCase() !== actualHeaderValue.toLowerCase()) {
            this.fail(`Header value '${expectedHeaderValue}' did not match for header '${expectedHeader}': '${actualHeaderValue}'`);
          }
        }
      }
    }
  }

  _validateHeaderContains(response) {
    for (let i = 0; i < this.headerContains.length; i++) {
      const expectedHeaderObject = this.headerContains[i];
      const expectedHeader = expectedHeaderObject.key;
      const expectedHeaderValue = expectedHeaderObject.value;
      if (!response.headers[expectedHeader]) {
        this.fail(`Header '${expectedHeader}' not present in HTTP response`);
      }
      if (expectedHeaderValue !== undefined) {
        const actualHeaderValue = response.headers[expectedHeader];
        if (expectedHeaderValue instanceof RegExp) {
          if (!expectedHeaderValue.test(actualHeaderValue)) {
            this.fail(`Header regex (${expectedHeaderValue}) did not match for header '${expectedHeader}': '${actualHeaderValue}'`);
          }
        } else {
          if (!actualHeaderValue.toLowerCase().includes(expectedHeaderValue.toLowerCase())) {
            this.fail(`Header value '${expectedHeaderValue}' did not match for header '${expectedHeader}': '${actualHeaderValue}'`);
          }
        }
      }
    }
  }

  _validateBody(response) {
    if (this.body !== null) {
      if (response.body instanceof Buffer) {
        const text = response.body.toString();
        assert.strictEqual(text, this.body);
      } else {
        assert.strictEqual(response.body, this.body);
      }
    }
  }

  _validateBodyContains(response) {
    for (let i = 0; i < this.bodyContains.length; i++) {
      const expectedBodyValue = this.bodyContains[i];
      if (expectedBodyValue instanceof RegExp) {
        if (response.body instanceof Buffer) {
          const text = response.body.toString();
          if (!expectedBodyValue.test(text)) {
            this.fail(`Value '${expectedBodyValue}' not found in response body`);
          }
        } else {
          if (!expectedBodyValue.test(response.body)) {
            this.fail(`Value '${expectedBodyValue}' not found in response body`);
          }
        }
      } else {
        if (response.body instanceof Buffer) {
          const text = response.body.toString();
          if (text.indexOf(expectedBodyValue) === -1) {
            this.fail(`Value '${expectedBodyValue}' not found in response body`);
          }
        } else {
          if (response.body.indexOf(expectedBodyValue) === -1) {
            this.fail(`Value '${expectedBodyValue}' not found in response body`);
          }
        }
      }
    }
  }

  _validateJson(response) {
    for (let i = 0; i < this.json.length; i++) {
      const expectedJSON = this.json[i];
      assert.deepStrictEqual(response.json, expectedJSON);
    }
  }

  _validateJsonLike(response) {
    for (let i = 0; i < this.jsonLike.length; i++) {
      const expectedJSON = this.jsonLike[i];
      const compare = new Compare();
      const res = compare.jsonLike(response.json, expectedJSON);
      if (!res.equal) {
        this.fail(res.message);
      }
    }
  }

  _validateJsonQuery(response) {
    for (let i = 0; i < this.jsonQuery.length; i++) {
      const jQ = this.jsonQuery[i];
      const value = jqy(jQ.path, { data: response.json }).value;
      if (typeof value === 'object') {
        assert.deepStrictEqual(value, jQ.value);
      } else {
        assert.strictEqual(value, jQ.value);
      }
    }
  }

  _validateJsonQueryLike(response) {
    for (let i = 0; i < this.jsonQueryLike.length; i++) {
      const jQ = this.jsonQueryLike[i];
      const value = jqy(jQ.path, { data: response.json }).value;
      const compare = new Compare();
      const res = compare.jsonLike(value, jQ.value);
      if (!res.equal) {
        this.fail(res.message);
      }
    }
  }

  _validateJsonSchema(response) {
    for (let i = 0; i < this.jsonSchema.length; i++) {
      const jS = this.jsonSchema[i];
      const jsv = new djv();
      jsv.addSchema('test', { common: jS });
      const validation = jsv.validate('test#/common', response.json);
      if (validation) {
        this.fail(`Response doesn't match with JSON schema - ${JSON.stringify(validation, null, 2)}`);
      }
    }
  }

  _validateResponseTime(response) {
    if (this.responseTime !== null) {
      if (response.responseTime > this.responseTime) {
        this.fail(`Request took longer than ${this.responseTime}ms: (${response.responseTime}ms).`);
      }
    }
  }

  _validateCustomExpectHandlers(request, response) {
    for (let i = 0; i < this.customExpectHandlers.length; i++) {
      const requiredHandler = this.customExpectHandlers[i];
      const ctx = { req: request, res: response, data: requiredHandler.data };
      if (typeof requiredHandler.handler === 'function') {
        requiredHandler.handler(ctx);
      } else {
        const handlerFun = handler.getExpectHandler(requiredHandler.handler);
        handlerFun(ctx);
      }
    }
  }

  fail(error) {
    assert.fail(error);
  }

}

module.exports = Expect;
