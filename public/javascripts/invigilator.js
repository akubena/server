define(['jquery', 'underscore', 'progress-bar'], function($, _, progress) {

    var exports = {};
    var REGISTRY = {};
    var invigilator = undefined;
    var desiredInvigilator = undefined;    
    
    var activity = {};
    
    exports.register = function(name, object) {
	REGISTRY[name] = object;
    };

    var CKAv2 = function() {
	this.problemOrder = [];

	for(var i=1; i<=39; i++ )
	    this.problemOrder.push( "v1/p" + (("0" + i).slice(-2)) );

	shuffle(this.problemOrder);	
	
	this.extraProblems = [];	
	
	for(var i=1; i<=182; i++ )
	    this.extraProblems.push( "v2/q" + i );

	shuffle(this.extraProblems);		

	this.answeredProblems = [];
	this.counter = 0;
    }

    CKAv2.prototype = {
	shortName: "CKA",
	name: "Calculus Knowledge Assessment",
	version: "2.0.1",

	tick: function() {
	    var proportionFinished = 0;
	    var maxSeconds = 60*20;
	    var goalProblems = 10;
	    
	    if (this.counter < maxSeconds)
		proportionFinished = proportionFinished + 0.5 * (this.counter / maxSeconds);
	    else
		proportionFinished = proportionFinished + 0.5;
	    
	    if (this.answeredProblems.length < goalProblems)
		proportionFinished = proportionFinished + 0.5 * (this.answeredProblems.length / goalProblems);
	    else {
		this.halfwayDone = true;
		proportionFinished = proportionFinished + 0.5;
	    }

	    if (proportionFinished > 0.99)
		this.allDone = true;
	    
	    progress.progressProportion( proportionFinished );
	    
	    if (!(activity.path.match(/welcome/))) {
		this.counter = this.counter + 1;
	    }

	    this.save();
	},
	
	setup: function() {
	    /*
	    this.counter = 0;
	    this.answeredProblems = [];
	    this.allDone = false;
	    this.halfwayDone = false;
	    */
	    window.setInterval( (function(self) {
		return function() {   
		    self.tick(); 
		}
	    })(this), 1000);

	    if ($('#previous-activity').hasClass('disabled'))
		$('#previous-activity').hide();
	    
	    $('#next-activity').removeClass('disabled');
	    
	    if (activity.path.match(/thanks/)) {
		nextLabel('You are welcome.');	    
		$('#next-activity').addClass('disabled');
	    } else if (activity.path.match(/welcome/)) {
		nextLabel('Get started!');
		$('#next-activity').addClass('pulse');	    
	    } else {
		nextLabel('I do not know how to solve this problem.');
	    }
	    
	    next( invigilator.next() );
	    
	    $('a','#next-activity').click( function(event) {
		if (invigilator) {
		    invigilator.onNext();
		    next( invigilator.next() );
		    invigilator.save();
		}
	    });
	    
	    $('body').on( 'ximera:attempt', function(event) {
		if (invigilator) {
		    invigilator.onAttempt();
		    next( invigilator.next() );
		    invigilator.save();
		}
	    });
	    
	    $('body').on( 'ximera:correct', function(event) {
		if (invigilator) {	    	    
		    invigilator.onCorrect();
		    next( invigilator.next() );		
		    invigilator.save();
		}
	    });		    
	},
	
	// On page state changes, "next" is called to determine what the next activity should be for the learner
	next: function() {
	    if (this.allDone)
		return 'thanks';

	    if (this.halfwayDone) {
		var i = this.extraProblems.indexOf(activity.path);

		if (i >= 0)
		    return this.extraProblems[(i+1) % this.extraProblems.length];
		else
		    return this.extraProblems[0];		    
	    }
	    
	    var i = this.problemOrder.indexOf(activity.path);

	    if (i >= 0)
		return this.problemOrder[(i+1) % this.problemOrder.length];
	    else
		return this.problemOrder[0];
	},
	
	onNext: function() {
	},

	onCorrect: function() {
	},

	onAttempt: function() {
	    if (this.answeredProblems.indexOf(activity.path) < 0)
		this.answeredProblems.push( activity.path );
	    
	    nextLabel('Try the next problem');
	    $('#next-activity').addClass('pulse');
	}		
    };
    
    function getCookieValue(a) {
	var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
	return b ? b.pop() : '';
    }

    // Clean up the address bar by removing the query string
    function eraseLocationSearch() {
	if ((window.history) && (window.history.pushState))
	    window.history.pushState( {}, document.title, window.location.pathname );
    }
    
    exports.register( 'cka', CKAv2 );

    function nextLabel( label ) {
    	$('#next-activity-label', '#next-activity').text(label);
    }
    
    function next( url ) {
	var href = "/activity/" + activity.commit + '/' + url;
	if (desiredInvigilator)
	    href = href + '?' + desiredInvigilator;
	
    	$('a', '#next-activity').attr('href', href);
    }

    function shuffle(array) {
	var currentIndex = array.length, temporaryValue, randomIndex;
	
	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
	    
	    // Pick a remaining element...
	    randomIndex = Math.floor(Math.random() * currentIndex);
	    currentIndex -= 1;
	    
	    // And swap it with the current element.
	    temporaryValue = array[currentIndex];
	    array[currentIndex] = array[randomIndex];
	    array[randomIndex] = temporaryValue;
	}
	
	return array;
    }
    
    $(function() {
	var a = $("#theActivity");
	activity.commit = a.attr('data-commit');
	activity.path = a.attr('data-path');
	activity.hash = a.attr('data-activity');
	
	// Invigilators can be invoked from the address bar after the ?...
	desiredInvigilator = location.search.replace(/^\?/,'');

	// And once invokved, they persist in the cookie storage
	if (desiredInvigilator.length > 0) {
	    eraseLocationSearch();
	    document.cookie = "invigilator=" + desiredInvigilator;
	} else {
	    desiredInvigilator = getCookieValue("invigilator");
	}

	// TODO: also perist in localstorage?

	if (REGISTRY[desiredInvigilator]) {
	    // Try to load it from LocalStorage
	    invigilator = new REGISTRY[desiredInvigilator]();

	    $('#invigilator-short-name').text(invigilator.shortName);
	    $('#invigilator-name').text(invigilator.name);	    
	    $('#invigilator').css('display', 'inline');
	    $('#invigilator').data( 'invigilator', invigilator );
	    
	    var properties = JSON.parse( localStorage.getItem( desiredInvigilator ) );
	    _.extend( invigilator, properties );
	
	    invigilator.setup();

	    invigilator.save = function() {
		console.log( "Saving invigilator..." );
		console.log( invigilator );
		localStorage.setItem( desiredInvigilator, JSON.stringify(invigilator) );
	    };
	    
	    invigilator.save();
	}
    });

    return exports;

    
});
    
