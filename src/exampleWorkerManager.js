/* eslint-env browser */
/* global CheckedEmitter */

'use strict';

// TODO: handle invalid grammar in textbox
// TODO: fix needed eamples bug (need force update to get rid of ident)

var ExampleWorker = require('worker!./exampleWorker-shim');
var ohmEditor = require('./ohmEditor');

var DEBUG = false;
var exampleWorkerManager = new CheckedEmitter();

exampleWorkerManager.registerEvents({
  'received:examples': ['ruleName', 'examples'],
  'received:neededExamples': ['neededExamples']
});

var eventsToEmit = ['received:examples', 'received:neededExamples'];

var exampleWorker = new ExampleWorker();

// TODO: may want to reset current worker instead

function resetWorker(grammar) {
  if (exampleWorker) {
    exampleWorker.terminate();
  }
  exampleWorker = new ExampleWorker();
  exampleWorker.onmessage = onWorkerMessage;
  exampleWorker.postMessage({
    name: 'initialize', recipe: grammar.toRecipe()
  });

  var examples = ohmEditor.examples.getExamples();
  Object.keys(examples).forEach(function(id) {
    var example = examples[id];
    var startRule = example.startRule in grammar.rules ?
        example.startRule : grammar.defaultStartRule;
    if (startRule && grammar.match(example.text, startRule).succeeded()) {
      exampleWorkerManager.addUserExample(startRule, example.text);
    }
  });
}

ohmEditor.addListener('parse:grammar', function(_, g, err) {
  if (!err) {
    resetWorker(g);
  }
});

ohmEditor.examples.addListener('set:example', function(_, oldValue, newValue) {
  if (newValue.text.trim() === '') {
    return;
  }

  var g = ohmEditor.grammar;
  if (oldValue && oldValue.text.trim() !== '') {
    resetWorker(g);
  } else if (g && g.match(newValue.text, newValue.startRule).succeeded()) {
    exampleWorkerManager.addUserExample(
        newValue.startRule || g.defaultStartRule,
        newValue.text);
  }
});

ohmEditor.examples.addListener('remove:example', function(_) {
  resetWorker(ohmEditor.grammar);
});

function onWorkerMessage(event) {
  if (eventsToEmit.includes(event.data.name)) {
    exampleWorkerManager.emit.apply(exampleWorkerManager,
                                    [event.data.name].concat(event.data.args));
  } else if (DEBUG) {
    console.debug('WORKER:', event.data);  // eslint-disable-line no-console
  }
}

exampleWorkerManager.requestExamples = function(ruleName) {
  relayEvent('request:examples', [ruleName]);
};

exampleWorkerManager.updateNeededExamples = function() {
  relayEvent('update:neededExamples', []);
};

exampleWorkerManager.addUserExample = function(ruleName, example) {
  relayEvent('add:userExample', [ruleName, example]);
};

function relayEvent(eventName, args) {
  exampleWorker.postMessage({
    name: eventName,
    args: args
  });
}

exampleWorkerManager.neededExamples = null;
exampleWorkerManager.addListener('received:neededExamples', function(neededExamples) {
  exampleWorkerManager.neededExamples = neededExamples;
});

// Exports
// -------

module.exports = exampleWorkerManager;
