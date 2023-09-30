/**
  @module ember-data
*/

import Ember from 'ember';

/**
  `DS.Serializer` is an abstract base class that you should override in your
  application to customize it for your backend. The minimum set of methods
  that you should implement is:

    * `normalizeResponse()`
    * `serialize()`

  And you can optionally override the following methods:

    * `normalize()`

  For an example implementation, see
  [DS.JSONSerializer](DS.JSONSerializer.html), the included JSON serializer.

  @class Serializer
  @namespace DS
  @extends Ember.Object
*/

export default Ember.Object.extend({

  /**
    The `store` property is the application's `store` that contains all records.
    It's injected as a service.
    It can be used to push records from a non flat data structure server
    response.

    @property store
    @type {DS.Store}
    @public
  */

  /**
    The `normalizeResponse` method is used to normalize a payload from the
    server to a JSON-API Document.

    http://jsonapi.org/format/#document-structure

    @since 1.13.0
    @method normalizeResponse
    @param {DS.Store} store
    @param {DS.Model} primaryModelClass
    @param {Object} payload
    @param {String|Number} id
    @param {String} requestType
    @return {Object} JSON-API Document
  */
  normalizeResponse: null,

  /**
    The `serialize` method is used when a record is saved in order to convert
    the record into the form that your external data source expects.

    `serialize` takes an optional `options` hash with a single option:

    - `includeId`: If this is `true`, `serialize` should include the ID
      in the serialized object it builds.

    @method serialize
    @param {DS.Model} record
    @param {Object} [options]
    @return {Object}
  */
  serialize: null,

  /**
    The `normalize` method is used to convert a payload received from your
    external data source into the normalized form `store.push()` expects. You
    should override this method, munge the hash and return the normalized
    payload.

    @method normalize
    @param {DS.Model} typeClass
    @param {Object} hash
    @return {Object}
  */
  normalize(typeClass, hash) {
    return hash;
  },

  /**
    `extractErrors` is used to extract model errors when a call
    to `DS.Model#save` fails with an `InvalidError`. By default
    Ember Data expects error information to be located on the `errors`
    property of the payload object.

    This serializer expects this `errors` object to be an Array similar
    to the following, compliant with the JSON-API specification:

    ```js
    {
      "errors": [
        {
          "detail": "This username is already taken!",
          "source": {
            "pointer": "data/attributes/username"
          }
        }, {
          "detail": "Doesn't look like a valid email.",
          "source": {
            "pointer": "data/attributes/email"
          }
        }
      ]
    }
    ```

    The key `detail` provides a textual description of the problem.
    Alternatively, the key `title` can be used for the same purpose.

    The nested keys `source.pointer` detail which specific element
    of the request data was invalid.

    Note that JSON-API also allows for object-level errors to be placed
    in an object with pointer `data`, signifying that the problem
    cannot be traced to a specific attribute:

    ```javascript
    {
      "errors": [
        {
          "detail": "Some generic non property error message",
          "source": {
            "pointer": "data"
          }
        }
      ]
    }
    ```

    When turn into a `DS.Errors` object, you can read these errors
    through the property `base`:

    ```handlebars
    {{#each model.errors.base as |error|}}
      <div class="error">
        {{error.message}}
      </div>
    {{/each}}
    ```

    Example of alternative implementation, overriding the default
    behavior to deal with a different format of errors:

    ```app/serializers/post.js
    import DS from 'ember-data';

    export default DS.JSONSerializer.extend({
      extractErrors: function(store, typeClass, payload, id) {
        if (payload && typeof payload === 'object' && payload._problems) {
          payload = payload._problems;
          this.normalizeErrors(typeClass, payload);
        }
        return payload;
      }
    });
    ```

    @method extractErrors
    @param {DS.Store} store
    @param {DS.Model} typeClass
    @param {Object} payload
    @param {(String|Number)} id
    @return {Object} json The deserialized errors
  */
  extractErrors(store, typeClass, payload, id) {
    return payload;
  },

});
