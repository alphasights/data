import { PromiseManyArray } from "ember-data/system/promise_proxies";
import Relationship from "ember-data/system/relationships/state/relationship";
import { OrderedSet } from "ember-data/system/map";
import  ManyArray from "ember-data/system/record_arrays/many_array";

var ManyRelationship = function(store, record, inverseKey, relationshipMeta) {
  this._super$constructor(store, record, inverseKey, relationshipMeta);
  this.belongsToType = relationshipMeta.type;
  this.manyArray = ManyArray.create({ content:Ember.A(), store:this.store, relationship:this, type:this.belongsToType});
  this.isPolymorphic = relationshipMeta.options.polymorphic;
  this.manyArray.isPolymorphic = this.isPolymorphic;
};

ManyRelationship.prototype = Object.create(Relationship.prototype);
ManyRelationship.prototype.constructor = ManyRelationship;
ManyRelationship.prototype._super$constructor = Relationship;

ManyRelationship.prototype.destroy = function() {
  this.manyArray.destroy();
};

ManyRelationship.prototype.notifyRecordRelationshipAdded = function(record, idx) {
  Ember.assert("You cannot add '" + record.constructor.typeKey + "' records to this relationship (only '" + this.belongsToType.typeKey + "' allowed)", !this.belongsToType || record instanceof this.belongsToType);
  this.record.notifyHasManyAdded(this.key, record, idx);
};

ManyRelationship.prototype.notifyRecordRelationshipRemoved = function(record) {
  this.record.notifyHasManyRemoved(this.key, record);
};

ManyRelationship.prototype.reload = function() {
  var self = this;
  if (this.link) {
    return this.fetchLink();
  } else {
    return this.store.scheduleFetchMany(this.manyArray.toArray()).then(function() {
      //Goes away after the manyArray refactor
      self.manyArray.set('isLoaded', true);
      return self.manyArray;
    });
  }
};

ManyRelationship.prototype.computeChanges = function(records) {
  var members = this.members;
  var recordsToRemove = [];
  var length;
  var record;
  var i;

  records = setForArray(records);

  members.forEach(function(member) {
    if (records.has(member)) return;

    recordsToRemove.push(member);
  });

  this.serverRemoveRecords(recordsToRemove);

  var hasManyArray = this.manyArray;

  // Using records.toArray() since currently using
  // removeRecord can modify length, messing stuff up
  // forEach since it directly looks at "length" each
  // iteration
  records = records.toArray();
  length = records.length;
  for (i = 0; i < length; i++){
    record = records[i];
    //Need to preserve the order of incoming records
    if (hasManyArray.objectAt(i) === record ) {
      continue;
    }
    this.serverRemoveRecord(record);
    this.serverAddRecord(record, i);
  }
};

ManyRelationship.prototype.fetchLink = function() {
  var self = this;
  return this.store.findHasMany(this.record, this.link, this.relationshipMeta).then(function(records){
    self.updateRecordsFromAdapter(records);
    return self.manyArray;
  });
};

ManyRelationship.prototype.findRecords = function() {
  var manyArray = this.manyArray;
  return this.store.findMany(manyArray.toArray()).then(function(){
    //Goes away after the manyArray refactor
    manyArray.set('isLoaded', true);
    return manyArray;
  });
};

ManyRelationship.prototype.getRecords = function() {
  if (this.isAsync) {
    var self = this;
    var promise;
    if (this.link) {
      promise = this.findLink().then(function() {
        return self.findRecords();
      });
    } else {
      promise = this.findRecords();
    }
    return PromiseManyArray.create({
      content: this.manyArray,
      promise: promise
    });
  } else {
      Ember.assert("You looked up the '" + this.key + "' relationship on a '" + this.record.constructor.typeKey + "' with id " + this.record.get('id') +  " but some of the associated records were not loaded. Either make sure they are all loaded together with the parent record, or specify that the relationship is async (`DS.hasMany({ async: true })`)", this.manyArray.isEvery('isEmpty', false));

    this.manyArray.set('isLoaded', true);
    return this.manyArray;
 }
};

function setForArray(array) {
  var set = new OrderedSet();

  if (array) {
    for (var i=0, l=array.length; i<l; i++) {
      set.add(array[i]);
    }
  }

  return set;
}

export default ManyRelationship;
