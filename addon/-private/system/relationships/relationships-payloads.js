import Ember from 'ember';
let get = Ember.get;

/**
  Manages relationship payloads for a given store.  Acts as a single source of
  truth (of payloads) for both sides of a relationship so they can agree on the
  most up-to-date payload received without needing too much eager processing
  when those payloads are pushed into the store.

  @example

    let relationshipsPayloads = new RelationshipsPayloads(store);

    const User = DS.Model.extend({
      hobbies: DS.hasMany('hobby')
    });

    const Hobby = DS.Model.extend({
      user: DS.belongsTo('user')
    });

    let userPayload = {
      data: {
        id: 1,
        type: 'user',
        relationships: {
          hobbies: {
            data: [{
              id: 2,
              type: 'hobby'
            }]
          }
        }
      },
    };
    relationshipsPayloads.push('user', 1, userPayload.data.relationships);

    relationshipsPayloads.get('hobby', 2, 'user') === {
      {
        data: {
          id: 1,
          type: 'user'
        }
      }
    }

  @private
  @class RelationshipsPayloads
*/
export default class RelationshipsPayloads {
  constructor(store) {
    this._store = store;
    // cache of `RelationshipPayload`s
    this._cache = Object.create(null);
  }

  /**
    Find the payload for the given relationship of the given model.

    Returns the payload for the given relationship, whether raw or computed from
    the payload of the inverse relationship.

    @example

      relationshipsPayloads.get('hobby', 2, 'user') === {
        {
          data: {
            id: 1,
            type: 'user'
          }
        }
      }

    @method
  */
  get(modelName, id, relationshipName) {
    let modelClass = this._store._modelFor(modelName);
    let relationshipsByName = get(modelClass, 'relationshipsByName');
    let relationshipPayloads = this._getRelationshipPayloads(modelName, relationshipName, modelClass, relationshipsByName, false);
    return relationshipPayloads && relationshipPayloads.get(modelName, id, relationshipName);
  }

  /**
    Push a model's relationships payload into this cache.

    @example

      let userPayload = {
        data: {
          id: 1,
          type: 'user',
          relationships: {
            hobbies: {
              data: [{
                id: 2,
                type: 'hobby'
              }]
            }
          }
        },
      };
      relationshipsPayloads.push('user', 1, userPayload.data.relationships);

    @method
  */
  push(modelName, id, relationshipsData) {
    if (!relationshipsData) { return; }

    let modelClass = this._store._modelFor(modelName);
    let relationshipsByName = get(modelClass, 'relationshipsByName');
    for (let key in relationshipsData) {
      let relationshipPayloads = this._getRelationshipPayloads(modelName, key, modelClass, relationshipsByName, true);
      if (relationshipPayloads) {
        relationshipPayloads.push(modelName, id, key, relationshipsData[key]);
      }
    }
  }

  unload(modelName, id) {
    let modelClass = this._store._modelFor(modelName);
    let relationshipsByName = get(modelClass, 'relationshipsByName');
    relationshipsByName.forEach((_, relationshipName) => {
      let relationshipPayloads = this._getRelationshipPayloads(modelName, relationshipName, modelClass, relationshipsByName, false);
      if (relationshipPayloads) {
        relationshipPayloads.unload(modelName, id, relationshipName);
      }
    });
  }

  /**
    Find the RelationshipPayloads object for the given relationship.  The same
    RelationshipPayloads object is returned for either side of a relationship.

    @example

      const User = DS.Model.extend({
        hobbies: DS.hasMany('hobby')
      });

      const Hobby = DS.Model.extend({
        user: DS.belongsTo('user')
      });

      relationshipPayloads.get('user', 'hobbies') === relationshipPayloads.get('hobby', 'user');

    @private
    @method
  */
  _getRelationshipPayloads(modelName, relationshipName, modelClass, relationshipsByName, init) {
    if (!relationshipsByName.has(relationshipName)) { return; }

    let key = `${modelName}:${relationshipName}`;
    if (!this._cache[key] && init) {
      return this._initializeRelationshipPayloads(modelName, relationshipName, modelClass, relationshipsByName);
    }

    return this._cache[key];
  }

  _initializeRelationshipPayloads(modelName, relationshipName, modelClass, relationshipsByName) {
    let relationshipMeta = relationshipsByName.get(relationshipName);
    let inverseMeta = modelClass.inverseFor(relationshipName, this._store);

    let inverseModelName;
    let inverseRelationshipName;
    let inverseRelationshipMeta;

    if (inverseMeta) {
      inverseRelationshipName = inverseMeta.name
      inverseModelName = relationshipMeta.type;
      inverseRelationshipMeta = get(inverseMeta.type, 'relationshipsByName').get(inverseRelationshipName);
    } else {
      inverseModelName = inverseRelationshipName = '';
      inverseRelationshipMeta = null;
    }

    let lhsKey = `${modelName}:${relationshipName}`;
    let rhsKey = `${inverseModelName}:${inverseRelationshipName}`;

    return this._cache[lhsKey] =
      this._cache[rhsKey] =
      new RelationshipPayloads(
        this._store,
        modelName,
        relationshipName,
        relationshipMeta,
        inverseModelName,
        inverseRelationshipName,
        inverseRelationshipMeta
      );
  }
}


/**
  Manages the payloads for both sides of a single relationship, across all model
  instances.

  For example, with

    const User = DS.Model.extend({
      hobbies: DS.hasMany('hobby')
    });

    const Hobby = DS.Model.extend({
      user: DS.belongsTo('user')
    });

    let relationshipPayloads = new RelationshipPayloads('user', 'hobbies', 'hobby', 'user');

    let userPayload = {
      data: {
        id: 1,
        type: 'user',
        relationships: {
          hobbies: {
            data: [{
              id: 2,
              type: 'hobby',
            }]
          }
        }
      }
    };

    // here we expect the payload of the individual relationship
    relationshipPayloads.push('user', 1, 'hobbies', userPayload.data.relationships.hobbies);

    relationshipPayloads.get('user', 1, 'hobbies');
    relationshipPayloads.get('hobby', 2, 'user');

  @class RelationshipPayloads
  @private
*/
class RelationshipPayloads {
  constructor(store, modelName, relationshipName, relationshipMeta, inverseModelName, inverseRelationshipName, inverseRelationshipMeta) {
    this._store = store;
    this._lhsModelName = modelName;
    this._lhsRelationshipName = relationshipName;
    this._lhsRelationshipMeta = relationshipMeta;
    this._rhsModelName = inverseModelName;
    this._rhsRelationshipName = inverseRelationshipName;
    this._rhsRelationshipMeta = inverseRelationshipMeta;

    this._lhsPayloads = {};
    if (modelName !== inverseModelName || relationshipName !== inverseRelationshipName) {
      this._rhsPayloads = {};
      this._isReflexive = false;
    } else {
      // Edge case when we have a reflexive relationship to itself
      //  eg user hasMany friends inverse friends
      this._rhsPayloads = this._lhsPayloads;
      this._isReflexive = true;
    }

    // either canoical on push or pending & flush
    this._pendingPayloads = [];
  }

  get(modelName, id, relationshipName) {
    this._flushPending();

    if (modelName === this._lhsModelName && relationshipName === this._lhsRelationshipName) {
      return this._lhsPayloads[id];
    } else {
      return this._rhsPayloads[id];
    }
  }

  push(modelName, id, relationshipName, relationshipData) {
    this._pendingPayloads.push([modelName, id, relationshipName, relationshipData]);
  }

  unload(modelName, id, relationshipName) {
    this._flushPending();

    if (modelName === this._lhsModelName && relationshipName === this._lhsRelationshipName) {
      this._unload(id, this._lhsPayloads, this._rhsPayloads);
    } else {
      this._unload(id, this._rhsPayloads, this._lhsPayloads);
    }
  }

  _unload(id, payloads, inversePayloads) {
    if (!this._inverseLoaded(payloads[id])) {
      this._removeInverse(id, payloads[id], inversePayloads);
      delete payloads[id];
    }
  }

  _flushPending() {
    if (this._pendingPayloads.length === 0) { return; }

    let work = this._pendingPayloads.splice(0, this._pendingPayloads.length);
    for (let i=0; i<work.length; ++i) {
      let modelName = work[i][0];
      let id = work[i][1];
      let relationshipName = work[i][2];
      let relationshipData = work[i][3];

      // TODO: maybe delay this slightly?
      let inverseRelationshipData = {
        data: {
          id: id,
          type: modelName
        }
      }

      if (modelName === this._lhsModelName && relationshipName === this._lhsRelationshipName) {
        this._removeInverse(id, this._lhsPayloads[id], this._rhsPayloads);
        this._lhsPayloads[id] = relationshipData;
        this._populateInverse(relationshipData, inverseRelationshipData, this._rhsPayloads, this._rhsRelationshipIsMany);
      } else {
        this._removeInverse(id, this._rhsPayloads[id], this._lhsPayloads);
        this._rhsPayloads[id] = relationshipData;
        this._populateInverse(relationshipData, inverseRelationshipData, this._lhsPayloads, this._lhsRelationshipIsMany);
      }
    }
  }

  _inverseLoaded(payload) {
    let data = payload && payload.data;
    if (!data) { return false; }

    if (Array.isArray(data)) {
      for (let i=0; i<data.length; ++i) {
        if (hasRecordForId(this._store, data[i].type, data[i].id)) {
          return true;
        }
      }
      return false;
    } else {
      return hasRecordForId(this._store, data.type, data.id);
    }
  }

  _populateInverse(relationshipData, inversePayload, inversePayloads, inverseIsMany) {
    if (!relationshipData.data) { return; }

    if (Array.isArray(relationshipData.data)) {
      for (let i=0; i<relationshipData.data.length; ++i) {
        let inverseId = relationshipData.data[i].id;
        this._addToInverse(inversePayload, inverseId, inversePayloads, inverseIsMany);
      }
    } else {
      let inverseId = relationshipData.data.id;
      this._addToInverse(inversePayload, inverseId, inversePayloads, inverseIsMany);
    }
  }

  _addToInverse(inversePayload, inverseId, inversePayloads, inverseIsMany) {
    if (this._isReflexive && inversePayload.data.id === inverseId) {
      // eg <user:1>.friends = [{ id: 1, type: 'user' }]
      return;
    }

    let existingPayload = inversePayloads[inverseId];
    let existingData = existingPayload && existingPayload.data;

    if (Array.isArray(existingData)) {
      existingData.push(inversePayload.data);
    } else {
      if (inverseIsMany) {
        inversePayloads[inverseId] = {
          data: [inversePayload.data]
        }
      } else {
        inversePayloads[inverseId] = inversePayload;
      }
    }
  }

  get _lhsRelationshipIsMany() {
    return this._lhsRelationshipMeta && this._lhsRelationshipMeta.kind === 'hasMany';
  }

  get _rhsRelationshipIsMany() {
    return this._rhsRelationshipMeta && this._rhsRelationshipMeta.kind === 'hasMany';
  }

  // TODO: diff rather than removeall addall?
  _removeInverse(id, payload, inversePayloads) {
    let data = payload && payload.data;
    if (!data) { return; }

    if (Array.isArray(data)) {
      for (let i=0; i<data.length; ++i) {
        this._removeFromInverse(id, data[i].id, inversePayloads);
      }
    } else {
      this._removeFromInverse(id, data.id, inversePayloads);
    }
  }

  _removeFromInverse(id, inverseId, inversePayloads) {
    let inversePayload = inversePayloads[inverseId];
    let data = inversePayload && inversePayload.data;

    if (!data) { return; }

    if (Array.isArray(data)) {
      inversePayload.data = data.filter((x) => x.id !== id);
    } else {
      inversePayloads[inverseId] = {
        data: null
      };
    }
  }
}

function hasRecordForId(store, type, id) {
  return typeof type === 'string' &&
    typeof id !== 'undefined' &&
    id !== null &&
    store.hasRecordForId(type, id);
}

