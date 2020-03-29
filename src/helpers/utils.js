const graphQL = require('./graphQL');
const Compare = require('./compare');

const log = require('./logger');

const utils = {

  /**
   * returns a matching interaction
   * @param {object} req - req object
   * @param {Map<string, object>} interactions - interactions
   */
  getMatchingInteraction(req, interactions) {
    const ids = Array.from(interactions.keys());
    for (let i = ids.length - 1; i >= 0; i--) {
      const interactionId = ids[i];
      log.debug(`Comparing interaction with id ${interactionId}`);
      const interaction = interactions.get(interactionId);
      const isValidMethod = (interaction.withRequest.method === req.method);
      if (!isValidMethod) {
        log.debug(`Interaction with id ${interactionId} failed to match - HTTP Method`);
        continue;
      }
      const isValidPath = (interaction.withRequest.path === req.path);
      if (!isValidPath) {
        log.debug(`Interaction with id ${interactionId} failed to match - HTTP Path`);
        continue;
      }
      let isValidQuery = true;
      if (!interaction.withRequest.ignoreQuery) {
        if (Object.keys(req.query).length > 0 || interaction.withRequest.query) {
          isValidQuery = validateQuery(req.query, interaction.withRequest.query, interaction.withRequest.matchingRules);
        }
      }
      if (!isValidQuery) {
        log.debug(`Interaction with id ${interactionId} failed to match - HTTP Query Params`);
        continue;
      }
      let isValidHeaders = true;
      if (interaction.withRequest.headers) {
        isValidHeaders = validateHeaders(req.headers, interaction.withRequest.headers, interaction.withRequest.matchingRules);
      }
      if (!isValidHeaders) {
        log.debug(`Interaction with id ${interactionId} failed to match - HTTP Headers`);
        continue;
      }
      let isValidBody = true;
      if (!interaction.withRequest.ignoreBody) {
        if (interaction.withRequest.graphQL) {
          isValidBody = graphQL.compare(req.body, interaction.withRequest.body);
        } else {
          if (typeof req.body === 'object') {
            if (Object.keys(req.body).length > 0) {
              isValidBody = validateBody(req.body, interaction.withRequest.body, interaction.withRequest.matchingRules);
            }
          } else if (req.body) {
            isValidBody = validateBody(req.body, interaction.withRequest.body, interaction.withRequest.matchingRules);
          }
        }
      }
      if (isValidMethod && isValidPath && isValidQuery && isValidHeaders && isValidBody) {
        return interaction;
      }
      log.debug(`Interaction with id ${interactionId} failed to match - HTTP Body`);
    }
    return null;
  }

};

function validateQuery(actual, expected, matchingRules) {
  if (typeof actual !== 'object' || typeof expected !== 'object') {
    return false;
  }
  const compare = new Compare();
  const response = compare.jsonMatch(actual, expected, matchingRules, '$.query');
  if (response.equal) {
    return compare.jsonMatch(expected, actual, matchingRules, '$.query').equal;
  } else {
    return response.equal;
  }
}

function validateHeaders(actual, expected, matchingRules) {
  // covert props of header to lower case : Content-Type -> content-type
  const lowerCaseActual = {};
  for (const prop in actual) {
    lowerCaseActual[prop.toLowerCase()] = actual[prop];
  }
  const lowerCaseExpected = {};
  for (const prop in expected) {
    lowerCaseExpected[prop.toLowerCase()] = expected[prop];
  }
  const compare = new Compare();
  const response = compare.jsonMatch(lowerCaseActual, lowerCaseExpected, matchingRules, '$.headers');
  return response.equal;
}

function validateBody(actual, expected, matchingRules) {
  const compare = new Compare();
  const response = compare.jsonMatch(actual, expected, matchingRules, '$.body');
  if (response.equal) {
    return compare.jsonMatch(expected, actual, matchingRules, '$.body').equal;
  } else {
    return response.equal;
  }
}

module.exports = utils;