test.otherModule = {
	blah: function() {
		// this depends on test.js and file1.js
		// so it shoudl be loaded afterwards
		test.superCoolModule.someMethod();
	}	
};