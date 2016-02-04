'use strict';

describe('parse', function() {
  it ('can parse an integer', function() {
    var fn = parse('42');
    expect(fn).toBeDefined();
    expect(fn()).toBe(42);
  });

  it('makes integers both constant and literal', function() {
    var fn = parse('42');
    expect(fn.constant).toBe(true);
    expect(fn.literal).toBe(true);
  });

  it('can parse a floating point number', function() {
    var fn = parse('4.2');
    expect(fn()).toBe(4.2);
  });

  it('can parse a floating point number without an integer part', function() {
    var fn = parse('.42');
    expect(fn()).toBe(0.42);
  });

  it('can parse a number in scientific notation', function() {
    var fn = parse('42e3');
    expect(fn()).toBe(42000);
  });

  it('can parse scientific notation with a float coefficient', function() {
    var fn = parse('.42e2');
    expect(fn()).toBe(42);
  });

  it('can parse scientific notation with negative exponents', function() {
    var fn = parse('4200e-2');
    expect(fn()).toBe(42);
  });

  it('can parse scientific notation with the + sign', function() {

  })
})