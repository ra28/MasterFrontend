topSuite("Ext.dataview.DataView", ['Ext.data.ArrayStore'], function() {

    var itNotTouch = jasmine.supportsTouch ? xit : it,
        view, store, navigationModel;

    var Model = Ext.define(null, {
        extend: 'Ext.data.Model',
        fields: ['name', 'age']
    });

    function makeData(rows, start) {
        var ret = [],
            i;

        start = start || 1;

        for (i = start; i <= (rows + start - 1); ++i) {
            ret.push(makeItem(i));
        }
        return ret;
    }

    function makeItem(i) {
        return {
            id: i,
            name: 'Item' + i,
            age: i + 20
        };
    }

    function makeStore(data, cfg) {
        if (typeof data === 'number') {
            data = makeData(data);
        }

        return new Ext.data.Store(Ext.apply({
            model: Model,
            data: data,
            asynchronousLoad: false,
            proxy: {
                type: 'ajax',
                url: 'fake'
            }
        }, cfg));
    }

    function makeView(viewCfg, storeCfg, options) {
        viewCfg = viewCfg || {};
        if (!storeCfg && storeCfg !== 0) {
            storeCfg = storeCfg || {};
        }
        options = options || {};

        if (!viewCfg.store && !options.preventStore) {
            if (typeof storeCfg === 'number' || Ext.isArray(storeCfg)) {
                storeCfg = makeStore(storeCfg);
            }
            viewCfg.store = storeCfg;
        }
        view = new Ext.dataview.DataView(Ext.apply({
            width: 400,
            itemTpl: '{name}',
            renderTo: options.preventRender ? undefined : document.body
        }, viewCfg));
        store = view.getStore();
        navigationModel = view.getNavigationModel();
    }

    function makeViewWaitsForFirstPaint(viewCfg, storeCfg, options) {
        makeView(viewCfg, storeCfg, options);
        waitsForFirstPaint();
    }

    function getElement(item) {
        return Ext.get(item);
    }

    function getElementAt(idx) {
        return getElement(view.getItemAt(idx));
    }

    beforeEach(function() {
        MockAjaxManager.addMethods();
    });

    afterEach(function() {
        view = store = Ext.destroy(view);
        MockAjaxManager.removeMethods();
    });

    function waitsForFirstPaint() {
        waitsForEvent(view, 'painted');
    }

    function waitsExpectData(values) {
        waitsForFirstPaint();
        runs(function() {
            expectData(values);
        });
    }

    function expectData(values) {
        var items = view.dataItems; // ignore things like emtpyTextCmp
        expect(values.length).toBe(items.length);
        values.forEach(function(v, i) {
            expect(items[i]).hasHTML(v);
        });
    }

    describe("cleanup", function() {
        it("should have the same component count", function() {
            var count = Ext.ComponentManager.getCount();
            makeViewWaitsForFirstPaint(null, 10);
            runs(function() {
                view.destroy();
                expect(Ext.ComponentManager.getCount()).toBe(count);
            });
        });
    });

    describe("configuring", function() {
        describe("store", function() {
            function getListenerKeys() {
                var items = store.hasListeners,
                    o = {},
                    key;

                for (key in items) {
                    if (items.hasOwnProperty(key)) {
                        o[key] = items[key];
                    }
                }
                return o;
            }

            describe("at construction", function() {
                it("should accept a store id", function() {
                    store = makeStore(2, {
                        id: 'foo',
                        autoDestroy: true  // such stores get registered for keeps
                    });
                    makeView({
                        store: 'foo'
                    });
                    expect(view.getStore()).toBe(store);
                    waitsExpectData(['Item1', 'Item2']);
                });

                it("should accept a store configuration", function() {
                    makeView({
                        store: {
                            model: Model,
                            data: makeData(3)
                        }
                    });
                    expect(view.getStore().getModel()).toBe(Model);
                    waitsExpectData(['Item1', 'Item2', 'Item3']);
                });

                it("should accept a store instance", function() {
                    store = makeStore(2);
                    makeView({
                        store: store
                    });
                    expect(view.getStore()).toBe(store);
                    waitsExpectData(['Item1', 'Item2']);
                });

                it("should be able to configure without a store", function() {
                    makeView(null, null, {
                        preventStore: true
                    });
                    var store = view.getStore();

                    expect(store).toBeNull();
                    waitsExpectData([]);
                });
            });

            describe("dynamic", function() {
                function expectMasked(masked) {
                    var mask = view.getMasked();
                    if (masked) {
                        expect(mask).toBeTruthy();
                        expect(mask.isVisible()).toBe(true);
                    } else {
                        if (mask) {
                            expect(mask.isVisible()).toBe(false);
                        } else {
                            expect(mask).toBeNull();
                        }
                    }
                }

                describe("view content", function() {
                    describe("with store -> no store", function() {
                        describe("store no has content", function() {
                            it("should have an empty view", function() {
                                makeView(null, 0);
                                waitsExpectData([]);
                                runs(function() {
                                    view.setStore(null);
                                    expectData([]);
                                    expectMasked(false);
                                });
                            });
                        });

                        describe("store has content", function() {
                            it("should have an empty view", function() {
                                makeView(null, 3);
                                waitsExpectData(['Item1', 'Item2', 'Item3']);
                                runs(function() {
                                    view.setStore(null);
                                    expectData([]);
                                    expectMasked(false);
                                });
                            });
                        });

                        describe("store is loading", function() {
                            it("should clear the load mask", function() {
                                store = makeStore();
                                makeView(null, store);
                                store.load();
                                expectMasked(true);
                                view.setStore(null);
                                expectMasked(false);
                                Ext.Ajax.mockCompleteWithData([]);
                                expectData([]);
                            });
                        });
                    });

                    describe("with no store -> store", function() {
                        beforeEach(function() {
                            makeView(null, null, {
                                preventStore: true
                            });
                            waitsExpectData([]);
                        });

                        describe("store has no content", function() {
                            it("should have an empty view", function() {
                                runs(function() {
                                    view.setStore(makeStore([]));
                                    expectData([]);
                                    expectMasked(false);
                                });
                            });
                        });

                        describe("store has content", function() {
                            it("should render the new content", function() {
                                runs(function() {
                                    view.setStore(makeStore(3));
                                    expectData(['Item1', 'Item2', 'Item3']);
                                    expectMasked(false);
                                });
                            });
                        });

                        describe("store is loading", function() {
                            it("should show a load mask", function() {
                                runs(function() {
                                    store = makeStore();
                                    store.load();
                                    expectMasked(false);
                                    view.setStore(store);
                                    expectMasked(true);
                                    Ext.Ajax.mockCompleteWithData(makeData(2));
                                    expectData(['Item1', 'Item2']);
                                });
                            });
                        });
                    });

                    describe("with store -> new store", function() {
                        function makeSuite(beforeFn, options) {
                            options = options || {
                                doExtraComplete: false,
                                expectMaskedInLoad: false
                            };

                            beforeEach(function() {
                                beforeFn();
                            });

                            describe("new store has no content", function() {
                                it("should have an empty view", function() {
                                    runs(function() {
                                        view.setStore(makeStore(0));
                                        expectData([]);
                                        expectMasked(false);
                                    });
                                });
                            });

                            describe("new store has content", function() {
                                it("should render the new content", function() {
                                    runs(function() {
                                        view.setStore(makeStore(3));
                                        expectData(['Item1', 'Item2', 'Item3']);
                                        expectMasked(false);
                                    });
                                });
                            });

                            describe("new store is loading", function() {
                                it("should show a load mask", function() {
                                    runs(function() {
                                        store = makeStore();
                                        store.load();
                                        expectMasked(options.expectMaskedInLoad);
                                        view.setStore(store);
                                        expectMasked(true);
                                        if (options.doExtraComplete) {
                                            Ext.Ajax.mockCompleteWithData([]);
                                        }
                                        Ext.Ajax.mockCompleteWithData(makeData(2));
                                        expectData(['Item1', 'Item2']);
                                    });
                                });
                            });
                        }

                        describe("old store has no content", function() {
                            makeSuite(function() {
                                makeView(null, 0);
                                waitsExpectData([]);
                            });
                        });

                        describe("old store has content", function() {
                            makeSuite(function() {
                                makeView(null, 1);
                                waitsExpectData(['Item1']);
                            });
                        });

                        describe("old store is loading", function() {
                            makeSuite(function() {
                                var s = makeStore();
                                makeView({
                                    store: s
                                });
                                s.load();
                            }, {
                                doExtraComplete: true,
                                expectMaskedInLoad: true
                            });
                        });
                    });
                });

                describe("cleanup", function() {
                    function makeSuite(fn) {
                        describe("with store autoDestroy: false", function() {
                            it("should unbind any listeners", function() {
                                store = makeStore(0, {
                                    autoDestroy: false
                                });

                                var before = getListenerKeys();

                                makeView({
                                    store: store
                                });
                                view.setStore(fn());
                                expect(store.destroyed).toBe(false);
                                expect(getListenerKeys()).toEqual(before);
                            });
                        });

                        describe("with store autoDestroy: true", function() {
                            it("should destroy the store", function() {
                                store = makeStore(0, {
                                    autoDestroy: true
                                });

                                makeView({
                                    store: store
                                });
                                view.setStore(fn());
                                expect(store.destroyed).toBe(true);
                            });
                        });
                    }

                    describe("setting a null store", function() {
                        makeSuite(function() {
                            return null;
                        });
                    });

                    describe("setting a new store", function() {
                        makeSuite(function() {
                            return makeStore(3);
                        });
                    });
                });
            });

            describe("destroy", function() {
                describe("with store autoDestroy: false", function() {
                    it("should unbind all listeners", function() {
                        store = makeStore(0, {
                            autoDestroy: false
                        });

                        var before = getListenerKeys();

                        makeView({
                            store: store
                        });
                        view.destroy();
                        expect(store.destroyed).toBe(false);
                        expect(getListenerKeys()).toEqual(before);
                    });
                });

                describe("with store autoDestroy: true", function() {
                    it("should destroy the store", function() {
                        store = makeStore(0, {
                            autoDestroy: true
                        });

                        makeView({
                            store: store
                        });
                        view.destroy();
                        expect(store.destroyed).toBe(true);
                    });
                });
            });
        });

        describe("data", function() {
            describe("at construction", function() {
                it("should generate a store", function() {
                    makeView({
                        data: makeData(3)
                    }, null, {
                        preventStore: true
                    });
                    waitsExpectData(['Item1', 'Item2', 'Item3']);
                });
            });

            describe("dynamic", function() {
                describe("with no store", function() {
                    it("should generate a store", function() {
                        makeViewWaitsForFirstPaint(null, null, {
                            preventStore: true
                        });

                        runs(function() {
                            var st = view.getStore();
                            expect(st).toBeNull();

                            view.setData(makeData(2));
                            st = view.getStore();
                            expect(st.getCount()).toBe(2);
                        });

                        waitsExpectData(['Item1', 'Item2']);
                    });
                });

                describe("with an existing store", function() {
                    it("should load the new data", function() {
                        makeView(null, 3);
                        var st = view.getStore();

                        waitsExpectData(['Item1', 'Item2', 'Item3']);

                        runs(function() {
                            view.setData(makeData(3, 4));
                            expect(view.getStore()).toBe(st);
                            expectData(['Item4', 'Item5', 'Item6']);
                        });
                    });
                });
            });
        });

        describe("emptyText", function() {
            function expectEmptyText(text) {
                var cmp = view.emptyTextCmp;

                if (text) {
                    expect(cmp.isVisible()).toBe(true);
                    expect(cmp.getHtml()).toBe(text);
                } else if (cmp) {
                    expect(cmp.isVisible()).toBe(false);
                } else {
                    expect(cmp).toBeFalsy();
                }
            }

            function waitsExpectEmptyText(text) {
                runs(function() {
                    expectEmptyText(text);
                });
            }

            describe("at construction", function() {
                describe("with deferEmptyText: false", function() {
                    describe("with no store", function() {
                        it("should show empty text", function() {
                            makeViewWaitsForFirstPaint({
                                deferEmptyText: false,
                                emptyText: 'Foo'
                            }, null, {
                                preventStore: true
                            });
                            waitsExpectEmptyText('Foo');
                        });
                    });

                    describe("with a store", function() {
                        describe("with an empty store", function() {
                            it("should show empty text", function() {
                                makeViewWaitsForFirstPaint({
                                    deferEmptyText: false,
                                    emptyText: 'Foo'
                                }, 0);
                                waitsExpectEmptyText('Foo');
                            });
                        });

                        describe("with a loading store", function() {
                            it("should not show empty text", function() {
                                store = makeStore();
                                store.load();
                                makeViewWaitsForFirstPaint({
                                    emptyText: 'Foo',
                                    deferEmptyText: false,
                                    store: store
                                });
                                waitsExpectEmptyText('');
                                runs(function() {
                                    Ext.Ajax.mockCompleteWithData([]);
                                });
                            });
                        });

                        describe("with a loaded store", function() {
                            it("should show empty text", function() {
                                store = makeStore();
                                store.load();
                                makeViewWaitsForFirstPaint({
                                    emptyText: 'Foo',
                                    deferEmptyText: false,
                                    store: store
                                });
                                runs(function() {
                                    Ext.Ajax.mockCompleteWithData([]);
                                });
                                waitsExpectEmptyText('Foo');
                            });
                        });

                        describe("with a populated store", function() {
                            it("should not show empty text", function() {
                                makeViewWaitsForFirstPaint({
                                    emptyText: 'Foo',
                                    deferEmptyText: false
                                }, 3);
                                waitsExpectEmptyText('');
                                runs(function() {
                                    Ext.Ajax.mockCompleteWithData([]);
                                });
                            });
                        });
                    });
                });

                describe("with deferEmptyText: true", function() {
                    describe("with no store", function() {
                        it("should not show empty text", function() {
                            makeViewWaitsForFirstPaint({
                                emptyText: 'Foo',
                                deferEmptyText: true
                            }, null, {
                                preventStore: true
                            });
                            waitsExpectEmptyText('');
                        });
                    });

                    describe("with a store", function() {
                        describe("with an empty store", function() {
                            it("should show empty text", function() {
                                makeViewWaitsForFirstPaint({
                                    emptyText: 'Foo',
                                    deferEmptyText: true
                                }, 0);
                                waitsExpectEmptyText('Foo');
                            });
                        });

                        describe("with a loading store", function() {
                            it("should not show empty text", function() {
                                store = makeStore();
                                store.load();
                                makeViewWaitsForFirstPaint({
                                    emptyText: 'Foo',
                                    deferEmptyText: true,
                                    store: store
                                });
                                waitsExpectEmptyText('');
                                runs(function() {
                                    Ext.Ajax.mockCompleteWithData([]);
                                });
                            });
                        });

                        describe("with a loaded store", function() {
                            it("should show empty text", function() {
                                store = makeStore();
                                store.load();
                                makeViewWaitsForFirstPaint({
                                    emptyText: 'Foo',
                                    deferEmptyText: true,
                                    store: store
                                });
                                runs(function() {
                                    Ext.Ajax.mockCompleteWithData([]);
                                });
                                waitsExpectEmptyText('Foo');
                            });
                        });

                        describe("with a populated store", function() {
                            it("should not show empty text", function() {
                                makeViewWaitsForFirstPaint({
                                    deferEmptyText: true,
                                    emptyText: 'Foo'
                                }, 3);
                                waitsExpectEmptyText('');
                            });
                        });
                    });
                });
            });

            describe("dynamic", function() {
                describe("with emptyText not visible", function() {
                    describe("setting empty text", function() {
                        it("should show the new emptyText", function() {
                            makeViewWaitsForFirstPaint({
                                emptyText: ''
                            }, 3);
                            waitsExpectEmptyText('');
                            runs(function() {
                                store.removeAll();
                                view.setEmptyText('Foo');
                                expectEmptyText('Foo');
                            });
                        });
                    });

                    describe("clearing empty text", function() {
                        it("should not show the emptyText", function() {
                            makeViewWaitsForFirstPaint(null, 3);
                            waitsExpectEmptyText('');
                            runs(function() {
                                store.removeAll();
                                view.setEmptyText('');
                                expectEmptyText('');
                            });
                        });
                    });

                    describe("changing empty text", function() {
                        it("should show the changed emptyText", function() {
                            makeViewWaitsForFirstPaint(null, 3);
                            waitsExpectEmptyText('');
                            runs(function() {
                                store.removeAll();
                                view.setEmptyText('Foo');
                                expectEmptyText('Foo');
                            });
                        });
                    });
                });

                describe("with emptyText visible", function() {
                    describe("setting empty text", function() {
                        it("should show the new emptyText", function() {
                            makeViewWaitsForFirstPaint({
                                deferEmptyText: false,
                                emptyText: ''
                            }, 0);
                            waitsExpectEmptyText('');
                            runs(function() {
                                store.removeAll();
                                view.setEmptyText('Foo');
                                expectEmptyText('Foo');
                            });
                        });
                    });

                    describe("clearing empty text", function() {
                        it("should not show the emptyText", function() {
                            makeViewWaitsForFirstPaint({
                                deferEmptyText: false
                            }, 0);
                            waitsExpectEmptyText(view.getEmptyText());
                            runs(function() {
                                store.removeAll();
                                view.setEmptyText('');
                                expectEmptyText('');
                            });
                        });
                    });

                    describe("changing empty text", function() {
                        it("should show the changed emptyText", function() {
                            makeViewWaitsForFirstPaint({
                                deferEmptyText: false,
                                emptyText: ''
                            }, 0);
                            waitsExpectEmptyText(view.getEmptyText());
                            runs(function() {
                                store.removeAll();
                                view.setEmptyText('Foo');
                                expectEmptyText('Foo');
                            });
                        });
                    });
                });
            });
        });

        describe("inline", function() {
            function getX(index) {
                var item = getElement(view.getItemAt(index));
                return item.getX();
            }

            function getY(index) {
                var item = getElement(view.getItemAt(index));
                return item.getY();
            }

            function expectPositions(positions) {
                positions.forEach(function(pos, idx) {
                    // Allow some fudge factor for subpixel rounding
                    expect(getX(idx)).toBeWithin(2, pos[0]);
                    expect(getY(idx)).toBeWithin(2, pos[1]);
                });
            }

            function makeInlineData(n) {
                var data = [],
                    i;

                for (i = 1; i <= n; ++i) {
                    data.push({
                        id: i,
                        name: '<div style="width: 50px; border: 1px solid red;">Item' + i + '</div>'
                    });
                }
                return data;
            }

            function getInlineFalsePos(w, h) {
                return [
                    [0, 0],
                    [0, 1 * h],
                    [0, 2 * h],
                    [0, 3 * h],
                    [0, 4 * h],
                    [0, 5 * h],
                    [0, 6 * h],
                    [0, 7 * h],
                    [0, 8 * h],
                    [0, 9 * h]
                ];
            }

            function getInlineTruePos(w, h) {
                return [
                    [0, 0],
                    [1 * w, 0],
                    [2 * w, 0],
                    [3 * w, 0],
                    [4 * w, 0],
                    [5 * w, 0],
                    [6 * w, 0],
                    [7 * w, 0],
                    [0, 1 * h],
                    [1 * w, 1 * h]
                ];
            }

            function getInlineNoWrapPos(w, h) {
                return [
                    [0, 0],
                    [1 * w, 0],
                    [2 * w, 0],
                    [3 * w, 0],
                    [4 * w, 0],
                    [5 * w, 0],
                    [6 * w, 0],
                    [7 * w, 0],
                    [8 * w, 0],
                    [9 * w, 0]
                ];
            }

            describe("at construction", function() {
                describe("with inline: false", function() {
                    it("should lay out items vertically", function() {
                        makeViewWaitsForFirstPaint({
                            inline: false
                        }, makeInlineData(10));
                        runs(function() {
                            var h = getElement(view.getItemAt(0)).getHeight();
                            expectPositions(getInlineFalsePos(50, h));
                        });
                    });
                });

                describe("with inline: true", function() {
                    it("should layout horizontally and wrap", function() {
                        makeViewWaitsForFirstPaint({
                            inline: true
                        }, makeInlineData(10));
                        runs(function() {
                            var h = getElement(view.getItemAt(0)).getHeight();
                            expectPositions(getInlineTruePos(50, h));
                        });
                    });
                });

                describe("with inline: {wrap: false}", function() {
                    it("should layout horizontally and not wrap", function() {
                        makeViewWaitsForFirstPaint({
                            inline: {
                                wrap: false
                            }
                        }, makeInlineData(10));
                        runs(function() {
                            var h = getElement(view.getItemAt(0)).getHeight();
                            expectPositions(getInlineNoWrapPos(50, h));
                        });
                    });
                });
            });

            describe("dynamic", function() {
                describe("from inline: false", function() {
                    beforeEach(function() {
                        makeViewWaitsForFirstPaint({
                            inline: false
                        }, makeInlineData(10));
                    });

                    describe("to inline: true", function() {
                        it("should layout horizontally and wrap", function() {
                            runs(function() {
                                view.setInline(true);
                                var h = getElement(view.getItemAt(0)).getHeight();
                                expectPositions(getInlineTruePos(50, h));
                            });
                        });
                    });

                    describe("to inline: {wrap: false}", function() {
                        it("should layout horizontally and not wrap", function() {
                            runs(function() {
                                view.setInline({
                                    wrap: false
                                });
                                var h = getElement(view.getItemAt(0)).getHeight();
                                expectPositions(getInlineNoWrapPos(50, h));
                            });
                        });
                    });
                });

                describe("from inline: true", function() {
                    beforeEach(function() {
                        makeViewWaitsForFirstPaint({
                            inline: true
                        }, makeInlineData(10));
                    });

                    describe("to inline: false", function() {
                        it("should lay out items vertically", function() {
                            runs(function() {
                                view.setInline(false);
                                var h = getElement(view.getItemAt(0)).getHeight();
                                expectPositions(getInlineFalsePos(50, h));
                            });
                        });
                    });

                    describe("to inline: {wrap: false}", function() {
                        it("should layout horizontally and not wrap", function() {
                            runs(function() {
                                view.setInline({
                                    wrap: false
                                });
                                var h = getElement(view.getItemAt(0)).getHeight();
                                expectPositions(getInlineNoWrapPos(50, h));
                            });
                        });
                    });
                });

                describe("from inline: {wrap: false}", function() {
                    beforeEach(function() {
                        makeViewWaitsForFirstPaint({
                            inline: {
                                wrap: false
                            }
                        }, makeInlineData(10));
                    });

                    describe("to inline: false", function() {
                        it("should lay out items vertically", function() {
                            runs(function() {
                                view.setInline(false);
                                var h = getElement(view.getItemAt(0)).getHeight();
                                expectPositions(getInlineFalsePos(50, h));
                            });
                        });
                    });

                    describe("to inline: true", function() {
                        it("should layout horizontally and wrap", function() {
                            runs(function() {
                                view.setInline(true);
                                var h = getElement(view.getItemAt(0)).getHeight();
                                expectPositions(getInlineTruePos(50, h));
                            });
                        });
                    });
                });
            });
        });

        describe("itemCls", function() {
            function expectCls(item, cls) {
                expect(item).toHaveCls(cls);
            }

            function expectNotCls(item, cls) {
                expect(item).not.toHaveCls(cls);
            }

            describe("at construction", function() {
                it("should use a configured class", function() {
                    makeViewWaitsForFirstPaint({
                        itemCls: 'test-foo'
                    }, 4);
                    runs(function() {
                        view.getViewItems().forEach(function(item) {
                            expectCls(item, 'test-foo');
                        });
                    });
                });
            });

            describe("dynamic", function() {
                describe("adding a class", function() {
                    beforeEach(function() {
                        makeViewWaitsForFirstPaint(null, 3);
                    });

                    it("should be able to add a class", function() {
                        runs(function() {
                            view.setItemCls('test-foo');
                            view.getViewItems().forEach(function(item) {
                                expectCls(item, 'test-foo');
                            });
                        });
                    });

                    it("should retain the class after data loads", function() {
                        runs(function() {
                            view.setItemCls('test-foo');
                            store.loadData(makeData(10, 100));
                            view.getViewItems().forEach(function(item) {
                                expectCls(item, 'test-foo');
                            });
                        });
                    });
                });

                describe("clearing a class", function() {
                    beforeEach(function() {
                        makeViewWaitsForFirstPaint({
                            itemCls: 'test-foo'
                        }, 3);
                    });

                    it("should be able to clear a class", function() {
                        runs(function() {
                            view.setItemCls(null);
                            view.getViewItems().forEach(function(item) {
                                expectNotCls(item, 'test-foo');
                            });
                        });
                    });

                    it("should retain the cleared class after data loads", function() {
                        runs(function() {
                            view.setItemCls(null);
                            store.loadData(makeData(10, 100));
                            view.getViewItems().forEach(function(item) {
                                expectNotCls(item, 'test-foo');
                            });
                        });
                    });
                });

                describe("changing a class", function() {
                    beforeEach(function() {
                        makeViewWaitsForFirstPaint({
                            itemCls: 'test-foo'
                        }, 3);
                    });

                    it("should be able to change a class", function() {
                        runs(function() {
                            view.setItemCls('test-bar');
                            view.getViewItems().forEach(function(item) {
                                expectNotCls(item, 'test-foo');
                                expectCls(item, 'test-bar');
                            });
                        });
                    });

                    it("should retain the class after data loads", function() {
                        runs(function() {
                            view.setItemCls('test-bar');
                            store.loadData(makeData(10, 100));
                            view.getViewItems().forEach(function(item) {
                                expectNotCls(item, 'test-foo');
                                expectCls(item, 'test-bar');
                            });
                        });
                    });
                });
            });
        });

        describe("itemTpl", function() {
            var tpl = '{name} - {age}';
            describe("at construction", function() {
                it("should use the passed itemTpl", function() {
                    makeView({
                        itemTpl: tpl
                    }, 3);
                    waitsExpectData(['Item1 - 21', 'Item2 - 22', 'Item3 - 23']);
                });
            });

            describe("dynamic", function() {
                it("should not cause an exception when updating itemTpl when no store is configured", function() {
                    makeViewWaitsForFirstPaint(null, null, {
                        preventStore: true
                    });
                    runs(function() {
                        view.setItemTpl(tpl);
                        expectData([]);
                    });
                });

                it("should be able to update before the first paint", function() {
                    makeView(null, 3);
                    view.setItemTpl(tpl);
                    waitsExpectData(['Item1 - 21', 'Item2 - 22', 'Item3 - 23']);
                });

                it("should be able to update after the first paint", function() {
                    makeViewWaitsForFirstPaint(null, 3);
                    runs(function() {
                        view.setItemTpl(tpl);
                        expectData(['Item1 - 21', 'Item2 - 22', 'Item3 - 23']);
                    });
                });
            });
        });
    });

    describe("methods", function() {
        function expectItems(values) {
            var items = view.getViewItems();
            expect(values.length).toBe(items.length);
            values.forEach(function(v, idx) {
                expectItem(items[idx], v);
            });
        }

        function expectItem(item, v) {
            expect(item.tagName).toBeTruthy();
            expect(item).hasHTML(v);
        }

        describe("getViewItems", function() {
            it("should return an empty array if there is no store", function() {
                makeViewWaitsForFirstPaint(null, null, {
                    preventStore: true
                });
                runs(function() {
                    expect(view.getViewItems()).toEqual([]);
                });
            });

            it("should return an empty array if there are no items", function() {
                makeViewWaitsForFirstPaint(null, 0);
                runs(function() {
                    expect(view.getViewItems()).toEqual([]);
                });
            });

            it("should return the items in the view", function() {
                makeViewWaitsForFirstPaint(null, 3);
                runs(function() {
                    expectItems(['Item1', 'Item2', 'Item3']);
                });
            });

            it("should react to view changes", function() {
                makeViewWaitsForFirstPaint(null, 3);
                runs(function() {
                    expectItems(['Item1', 'Item2', 'Item3']);
                    store.removeAt(0);
                    expectItems(['Item2', 'Item3']);
                    store.add({
                        name: 'Foo'
                    });
                    expectItems(['Item2', 'Item3', 'Foo']);
                    store.removeAll();
                    expect(view.getViewItems()).toEqual([]);
                });
            });

            it("should not return a live collection", function() {
                makeViewWaitsForFirstPaint(null, 3);
                runs(function() {
                    var items = view.getViewItems();
                    store.removeAt(0);
                    expect(view.getViewItems()).not.toBe(items);
                    expect(view.getViewItems().length).not.toBe(items.length);
                });
            });
        });

        describe("getItemAt", function() {
            describe("invalid indexes", function() {
                it("should return null for an index < start index - accounting for reverse indexing", function() {
                    makeViewWaitsForFirstPaint(null, 3);
                    runs(function() {
                        expect(view.getItemAt(-4)).toBeNull();
                    });
                });

                it("should return null for an index >= length", function() {
                    makeViewWaitsForFirstPaint(null, 3);
                    runs(function() {
                        expect(view.getItemAt(3)).toBeNull();
                    });
                });
            });

            describe("valid indexes", function() {
                beforeEach(function() {
                    makeViewWaitsForFirstPaint(null, 5);
                });

                it("should return the first item", function() {
                    runs(function() {
                        var item = view.getItemAt(0);
                        expectItem(item, 'Item1');

                        // Test negative indexing. -1 means last
                        item = view.getItemAt(-5);
                        expectItem(item, 'Item1');
                    });
                });

                it("should return a middle item", function() {
                    runs(function() {
                        var item = view.getItemAt(2);
                        expectItem(item, 'Item3');

                        // Test negative indexing. -1 means last
                        item = view.getItemAt(-3);
                        expectItem(item, 'Item3');
                    });
                });

                it("should return the last item", function() {
                    runs(function() {
                        var item = view.getItemAt(4);
                        expectItem(item, 'Item5');

                        // Test negative indexing. -1 means last
                        item = view.getItemAt(-1);
                        expectItem(item, 'Item5');
                    });
                });
            });
        });

        describe("getItemIndex", function() {
            it("should return -1 for null", function() {
                makeViewWaitsForFirstPaint(null, 3);
                runs(function() {
                    expect(view.getItemIndex(null)).toBe(-1);
                });
            });

            it("should return -1 for an item not in the view", function() {
                makeViewWaitsForFirstPaint(null, 3);
                runs(function() {
                    var item = view.getItemAt(0);
                    store.removeAt(0);
                    expect(view.getItemIndex(item)).toBe(-1);
                });
            });

            it("should return the item index", function() {
                makeViewWaitsForFirstPaint(null, 3);
                runs(function() {
                    var items = view.getViewItems();
                    expect(view.getItemIndex(items[0])).toBe(0);
                    expect(view.getItemIndex(items[1])).toBe(1);
                    expect(view.getItemIndex(items[2])).toBe(2);
                });
            });
        });
    });

    describe("item events", function() {
        var helper = Ext.testHelper,
            spy;

        beforeEach(function() {
            spy = jasmine.createSpy();
        });

        afterEach(function() {
            spy = null;
        });

        function expectArgs(idx) {
            var item = view.getItemAt(idx),
                args = spy.mostRecentCall.args;

            expect(args[0]).toBe(view);
            expect(args[1]).toBe(idx);
            expect(args[2]).toBe(Ext.get(item));
            expect(args[3]).toBe(store.getAt(idx));
            expect(args[4] instanceof Ext.event.Event).toBe(true);
        }

        function getCenter(el) {
            return Ext.fly(el).getXY();
        }

        function doTouch(method, idx, cfg) {
            runs(function() {
                cfg = cfg || {};

                var el = getElementAt(idx),
                    center = getCenter(el),
                    x = cfg.hasOwnProperty('x') ? cfg.x : center[0],
                    y = cfg.hasOwnProperty('y') ? cfg.y : center[1],
                    offsetX = cfg.hasOwnProperty('offsetX') ? cfg.offsetX : 0,
                    offsetY = cfg.hasOwnProperty('offsetY') ? cfg.offsetY : 0;

                helper[method](el, {
                    x: x + offsetX,
                    y: y + offsetY
                });
                waitsForAnimation();
            });
        }

        function touchStart(idx, cfg) {
            doTouch('touchStart', idx, cfg);
        }

        function touchMove(idx, cfg) {
            doTouch('touchMove', idx, cfg);
        }

        function touchEnd(idx, cfg) {
            doTouch('touchEnd', idx, cfg);
        }

        function touchCancel(idx, cfg) {
            doTouch('touchCancel', idx, cfg);
        }

        function tap(idx, cfg) {
            doTouch('tap', idx, cfg);
        }

        describe("deprecated item events", function() {
            function makeWithEvent(event) {
                var listeners = {};
                listeners[event] = spy;
                makeViewWaitsForFirstPaint({
                    listeners: listeners
                }, 5);
                view.preventEventWarning = true;
            }

            it("should fire the itemtouchstart event", function() {
                makeWithEvent('itemtouchstart');
                touchStart(0);
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(0);
                    touchCancel(0);
                });
            });

            it("should fire the itemtouchmove event", function() {
                makeWithEvent('itemtouchmove');
                touchStart(1);
                touchMove(1, {
                    offsetX: 50,
                    offsetY: 0
                });
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(1);
                    touchCancel(1);
                });
            });

            it("should fire the itemtouchend event", function() {
                makeWithEvent('itemtouchend');
                touchStart(1);
                touchMove(1, {
                    offsetX: 50,
                    offsetY: 0
                });
                touchEnd(1);
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(1);
                });
            });

            (Ext.supports.Touch ? it : xit)("should fire the itemtouchcancel event", function() {
                makeWithEvent('itemtouchcancel');
                touchStart(1);
                touchMove(1, {
                    offsetX: 50,
                    offsetY: 0
                });
                touchCancel(1);
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(1);
                });
            });

            it("should fire the itemtap event", function() {
                makeWithEvent('itemtap');
                tap(2);
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(2);
                });
            });

            it("should fire the itemlongpress event", function() {
                makeWithEvent('itemlongpress');
                touchStart(1);
                //waits(Ext.event.gesture.LongPress.instance.getMinDuration());
                waitsFor(function () {
                    return spy.callCount === 1;
                });
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(1);
                    touchCancel(1);
                });
            });

            it("should fire the itemtaphold event", function() {
                makeWithEvent('itemtaphold');
                touchStart(1);
                //waits(Ext.event.gesture.LongPress.instance.getMinDuration());
                waitsFor(function () {
                    return spy.callCount === 1;
                });
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(1);
                    touchCancel(1);
                });
            });

            it("should fire the itemsingletap event", function() {
                makeWithEvent('itemsingletap');
                tap(3);
                //waits(Ext.event.gesture.DoubleTap.instance.getMaxDuration());
                waitsFor(function () {
                    return spy.callCount === 1;
                });
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(3);
                });
            });

            it("should fire the itemdoubletap event", function() {
                makeWithEvent('itemdoubletap');
                tap(0);
                tap(0);
                //waits(Ext.event.gesture.DoubleTap.instance.getMaxDuration());
                waitsFor(function () {
                    return spy.callCount === 1;
                });
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(0);
                });
            });

            it("should fire the itemswipe event", function() {
                makeWithEvent('itemswipe');
                touchStart(0, {
                    x: 0,
                    y: 0
                });
                touchMove(0, {
                    offsetX: Ext.event.gesture.Swipe.instance.getMinDistance() + 20,
                    offsetY: 0
                });
                touchEnd(0, {
                    offsetX: Ext.event.gesture.Swipe.instance.getMinDistance() + 20,
                    offsetY: 0
                });
                runs(function() {
                    expect(spy.callCount).toBe(1);
                    expectArgs(0);
                });
            });

            itNotTouch("should fire the itemmouseenter event", function() {
                makeWithEvent('itemmouseenter');
                runs(function() {
                    jasmine.fireMouseEvent(getElementAt(2), 'mouseover');
                    expect(spy.callCount).toBe(1);
                    expectArgs(2);
                });
            });

            itNotTouch("should fire the itemmouseleave event", function() {
                makeWithEvent('itemmouseleave');
                runs(function() {
                    jasmine.fireMouseEvent(getElementAt(2), 'mouseout');
                    expect(spy.callCount).toBe(1);
                    expectArgs(2);
                });
            });
        });
    });

    describe("reacting to store changes", function() {
        describe("loading", function() {
            describe("remote", function() {
                it("should update when the store loads", function() {
                    makeView(null, 0);
                    store.load();
                    waitsForFirstPaint();
                    runs(function() {
                        Ext.Ajax.mockCompleteWithData(makeData(3));
                        expectData(['Item1', 'Item2', 'Item3']);
                    });
                });
            });

            describe("local", function() {
                it("should update when the store loads", function() {
                    makeViewWaitsForFirstPaint(null, 0);
                    runs(function() {
                        store.loadData(makeData(3));
                        expectData(['Item1', 'Item2', 'Item3']);
                    });
                });
            });
        });

        describe("adding", function() {
            describe("single record", function() {
                it("should be able to add to an empty view", function() {
                    makeViewWaitsForFirstPaint(null, 0);
                    runs(function() {
                        store.add(makeItem(1));
                        expectData(['Item1']);
                    });
                });

                it("should be able to add to the start of a view", function() {
                    makeViewWaitsForFirstPaint(null, 3);
                    runs(function() {
                        store.insert(0, makeItem(4));
                        expectData(['Item4', 'Item1', 'Item2', 'Item3']);
                    });
                });

                it("should be able to add to the middle of the view", function() {
                    makeViewWaitsForFirstPaint(null, 4);
                    runs(function() {
                        store.insert(2, makeItem(5));
                        expectData(['Item1', 'Item2', 'Item5', 'Item3', 'Item4']);
                    });
                });

                it("should be able to add to the end of a view", function() {
                    makeViewWaitsForFirstPaint(null, 3);
                    runs(function() {
                        store.add(makeItem(4));
                        expectData(['Item1', 'Item2', 'Item3', 'Item4']);
                    });
                });
            });

            describe("multiple records", function() {
                describe("contiguous range", function() {
                    it("should be able to add to an empty view", function() {
                        makeViewWaitsForFirstPaint(null, 0);
                        runs(function() {
                            store.add(makeData(2));
                            expectData(['Item1', 'Item2']);
                        });
                    });

                    it("should be able to add to the start of a view", function() {
                        makeViewWaitsForFirstPaint(null, 3);
                        runs(function() {
                            store.insert(0, makeData(2, 4));
                            expectData(['Item4', 'Item5', 'Item1', 'Item2', 'Item3']);
                        });
                    });

                    it("should be able to add to the middle of the view", function() {
                        makeViewWaitsForFirstPaint(null, 4);
                        runs(function() {
                            store.insert(2, makeData(3, 5));
                            expectData(['Item1', 'Item2', 'Item5', 'Item6', 'Item7', 'Item3', 'Item4']);
                        });
                    });

                    it("should be able to add to the end of a view", function() {
                        makeViewWaitsForFirstPaint(null, 3);
                        runs(function() {
                            store.add(makeData(2, 4));
                            expectData(['Item1', 'Item2', 'Item3', 'Item4', 'Item5']);
                        });
                    });
                });

                describe("discontiguous range", function() {
                    it("should be able to add nodes", function() {
                        makeViewWaitsForFirstPaint({
                            store: {
                                data: [makeItem(1), makeItem(4), makeItem(7)],
                                sorters: 'id'
                            }
                        });
                        runs(function() {
                            store.add([
                                makeItem(2),
                                makeItem(3),
                                makeItem(5),
                                makeItem(6),
                                makeItem(8)
                            ]);
                            expectData(['Item1', 'Item2', 'Item3', 'Item4', 'Item5', 'Item6', 'Item7', 'Item8']);
                        });
                    });
                });
            });
        });

        describe("updating", function() {
            beforeEach(function() {
                makeViewWaitsForFirstPaint(null, 5);
            });

            it("should update the content", function() {
                runs(function() {
                    store.first().set('name', 'Foo');
                    expectData(['Foo', 'Item2', 'Item3', 'Item4', 'Item5']);
                });
            });

            describe("while sorted", function() {
                it("should move the item if the change causes the item to move to the end", function() {
                    runs(function() {
                        store.getSorters().add('name');
                        store.first().set('name', 'Item6');
                        expectData(['Item2', 'Item3', 'Item4', 'Item5', 'Item6']);
                    });
                });

                it("should move the item if the change causes the item to move to the start", function() {
                    runs(function() {
                        store.getSorters().add('name');
                        store.last().set('name', 'Item0');
                        expectData(['Item0', 'Item1', 'Item2', 'Item3', 'Item4']);
                    });
                });

                it("should move the item if the change causes the item to move to the middle", function() {
                    runs(function() {
                        store.getSorters().add('name');
                        store.first().set('name', 'Item3.5');
                        expectData(['Item2', 'Item3', 'Item3.5', 'Item4', 'Item5']);
                    });
                });
            });

            describe("while filtered", function() {
                it("should show the item when the change includes it in the filter", function() {
                    var rec = store.first();

                    store.getFilters().add({
                        filterFn: function(rec) {
                            return rec.get('name') >= 'Item2';
                        }
                    });
                    expectData(['Item2', 'Item3', 'Item4', 'Item5']);
                    rec.set('name', 'Item6');
                    expectData(['Item2', 'Item3', 'Item4', 'Item5', 'Item6']);
                });

                it("should hide the item when the change excludes it from the filter", function() {
                    store.getFilters().add({
                        filterFn: function(rec) {
                            return rec.get('name') <= 'Item5';
                        }
                    });
                    expectData(['Item1', 'Item2', 'Item3', 'Item4', 'Item5']);
                    store.first().set('name', 'Item6');
                    expectData(['Item2', 'Item3', 'Item4', 'Item5']);
                });

                it('should ignore updates of items which are filtered out', function() {
                    var thirdRec = store.getAt(2);

                    store.getFilters().add({
                        filterFn: function(rec) {
                            return rec.get('age') < 23;
                        }
                    });

                    expectData(['Item1', 'Item2']);
                    expect(store.contains(thirdRec)).toBe(false);
                    expect(function() {
                        thirdRec.set('name', 'Foo');
                    }).not.toThrow();
                });
            });
        });

        describe("removing", function() {
            describe("single record", function() {
                it("should be able to remove the last record", function() {
                    makeViewWaitsForFirstPaint(null, 1);
                    runs(function() {
                        store.removeAt(0);
                        expectData([]);
                    });
                });

                it("should be able to remove from the start", function() {
                    makeViewWaitsForFirstPaint(null, 5);
                    runs(function() {
                        store.removeAt(0);
                        expectData(['Item2', 'Item3', 'Item4', 'Item5']);
                    });
                });

                it("should be able to remove from the middle", function() {
                    makeViewWaitsForFirstPaint(null, 5);
                    runs(function() {
                        store.removeAt(2);
                        expectData(['Item1', 'Item2', 'Item4', 'Item5']);
                    });
                });

                it("should be able to remove from the end", function() {
                    makeViewWaitsForFirstPaint(null, 5);
                    runs(function() {
                        store.removeAt(4);
                        expectData(['Item1', 'Item2', 'Item3', 'Item4']);
                    });
                });
            });

            describe("multiple records", function() {
                beforeEach(function() {
                    makeViewWaitsForFirstPaint(null, 7);
                });

                describe("contiguous range", function() {
                    it("should be able to remove from the start", function() {
                        runs(function() {
                            store.removeAt(0, 2);
                            expectData(['Item3', 'Item4', 'Item5', 'Item6', 'Item7']);
                        });
                    });

                    it("should be able to remove from the middle", function() {
                        runs(function() {
                            store.removeAt(2, 3);
                            expectData(['Item1', 'Item2', 'Item6', 'Item7']);
                        });
                    });

                    it("should be able to remove from the end", function() {
                        runs(function() {
                            store.removeAt(5, 2);
                            expectData(['Item1', 'Item2', 'Item3', 'Item4', 'Item5']);
                        });
                    });
                });

                describe("discontiguous range", function() {
                    it("should be able to remove nodes", function() {
                        runs(function() {
                            store.remove([store.getAt(0), store.getAt(3), store.getAt(6)]);
                            expectData(['Item2', 'Item3', 'Item5', 'Item6']);
                        });
                    });
                });

                describe("all records", function() {
                    it("should remove all nodes", function() {
                        runs(function() {
                            store.removeAll();
                            expectData([]);
                        });
                    });
                });
            });
        });

        describe("sorting", function() {
            it("should react to sorting", function() {
                makeView(null, 7);
                waitsExpectData(['Item1', 'Item2', 'Item3', 'Item4', 'Item5', 'Item6', 'Item7']);
                runs(function() {
                    store.getSorters().add({
                        property: 'name',
                        direction: 'DESC'
                    });
                    expectData(['Item7', 'Item6', 'Item5', 'Item4', 'Item3', 'Item2', 'Item1']);
                });
            });
        });

        describe("filtering", function() {
            function filter(rec) {
                return rec.id % 2 === 0;
            }

            it("should exclude items that do not match the filter", function() {
                makeView(null, 7);
                waitsExpectData(['Item1', 'Item2', 'Item3', 'Item4', 'Item5', 'Item6', 'Item7']);
                runs(function() {
                    store.getFilters().add({
                        filterFn: filter
                    });
                    expectData(['Item2', 'Item4', 'Item6']);
                });
            });

            it("should include items when the filter is cleared", function() {
                makeView({
                    store: {
                        data: makeData(7),
                        filters: [{
                            filterFn: filter
                        }]
                    }
                });
                waitsExpectData(['Item2', 'Item4', 'Item6']);
                runs(function() {
                    store.getFilters().removeAll();
                    waitsExpectData(['Item1', 'Item2', 'Item3', 'Item4', 'Item5', 'Item6', 'Item7']);
                });
            });
        });
    });

    describe("selection", function() {
        describe("initial selection", function() {
            it("should be able to configure the initial selection", function() {
                store = makeStore(5);
                makeViewWaitsForFirstPaint({
                    store: store,
                    selection: store.getAt(2)
                });
                runs(function() {
                    expect(getElement(view.getItemAt(2))).toHaveCls('x-selected');
                });
            });
        });
    });

    xdescribe('Location and navigation', function() {
        var rec,
            location,
            inputField,
            focusEnterSpy,
            focusLeaveSpy,
            focusMoveSpy;

        function expectLocation(expected) {
            location = navigationModel.getLocation();

            if (expected == null) {
                expect(location).toBeNull();
                expect(view.el.contains(document.activeElement)).toBe(false);
                expect(view.el.query('.' + view.focusedCls).length).toBe(0);
            } else {
                expected = new Ext.dataview.Location({
                    view: view,
                    item: expected
                });

                expect(location.equals(expected)).toBe(true);
                expect(document.activeElement).toBe(location.getFocusEl(true));
                expect(location.getFocusEl()).toHaveCls(view.focusedCls);
            }
        }

        // Begin the tests with a focused view.
        beforeEach(function() {
            makeViewWaitsForFirstPaint(null, 10);
            focusEnterSpy = spyOn(view, 'onFocusEnter').andCallThrough();
            focusLeaveSpy = spyOn(view, 'onFocusLeave').andCallThrough();
            focusMoveSpy = spyOn(view.getNavigationModel(), 'onFocusMove').andCallThrough();

            view.focus();

            waitsForSpy(focusEnterSpy);

            runs(function() {
                focusEnterSpy.reset();
            });
        });

        afterEach(function() {
            Ext.destroy(inputField);
        });

        it('should focus the first item when focused from above', function() {
            runs(function() {
                expectLocation(0);
            });
        });
        it('should focus the last item when focused from below', function() {
            // We don't want the autofocused view.
            Ext.destroy(view);

            makeViewWaitsForFirstPaint(null, 10);
            focusEnterSpy = spyOn(view, 'onFocusEnter').andCallThrough();
            inputField = Ext.getBody().createChild({
                tag: 'input',
                type: 'text'
            });

            focusAndWait(inputField);

            runs(function() {
                view.focus();
            });

            waitsForSpy(focusEnterSpy);

            runs(function() {
                expectLocation(store.getCount() - 1);
            });
        });
        it('should be able to navigate to a record', function() {
            navigationModel.setLocation(store.getAt(5));

            expectLocation(5);
        });
        it('should be able to navigate to an element', function() {
            navigationModel.setLocation(view.getItem(5));

            expectLocation(5);
        });
        it('should be able to navigate to a number', function() {
            navigationModel.setLocation(5);

            expectLocation(5);
        });
        it('should refocus last focused when refocused', function() {
            inputField = Ext.getBody().createChild({
                tag: 'input',
                type: 'text'
            });

            navigationModel.setLocation(5);

            expectLocation(5);

            inputField.focus();

            waitsForSpy(focusLeaveSpy);

            // No location when not focused
            runs(function() {
                focusEnterSpy.reset();
                expectLocation();
                view.focus();
            });

            // Untargeted refocus - should go to location 5
            waitsForSpy(focusEnterSpy);

            // Focus should be back where it was
            runs(function() {
                expectLocation(5);
            });
        });

        it('should navigate on arrow keys', function() {
            expectLocation(0);
            jasmine.fireKeyEvent(document.activeElement, 'keydown', Ext.event.Event.DOWN);

            waitsForSpy(focusMoveSpy);

            runs(function() {
                expectLocation(1);
            });
        });
    });
});
