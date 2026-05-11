/*
 * **************************************************************************************
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * **************************************************************************************
 */

FoEproxy.addFoeHelperHandler('CityMapUpdated', () => {
	BuildingTracker.update();
});

FoEproxy.addFoeHelperHandler('InventoryUpdated', () => {
	BuildingTracker.update();
});

window.addEventListener('foe-helper#loaded', () => {
	BuildingTracker.init();
}, {capture: false, once: true, passive: true});


/**
 * @type {{Config: {SummerBonus: {icon: string, ids: string[], specialKitIds: string[], kitsPerBuilding: number}, Expedition: {icon: string, ids: string[]}, EasterBonus: {icon: string, ids: string[]}, GreatBuildings: string[]}, getBuildingIconUrl: function(*): *, isVisible: boolean, update: function(), updateGreatBuildings: function(), updateDiamondBadge: function(), updateRegularBuildings: function(), buildWidget: function(), init: function(), toggle: function()}}
 */
let BuildingTracker = {

	isVisible: true,

	/**
	 * Hardcoded configuration
	 */
	Config: {
		GreatBuildings: [
			'X_FutureEra_Landmark1',
			'X_ProgressiveEra_Landmark2',
			'X_OceanicFuture_Landmark3',
			'X_ArcticFuture_Landmark3',
			'X_AllAge_Expedition'
		],
		EasterBonus: {
			icon: 'W_AllAge_EasterBonus1',
			ids: ['W_AllAge_EasterBonus1', 'W_AllAge_EasterBonus1Small']
		},
		Expedition: {
			icon: 'W_AllAge_Expedition16',
			ids: ['W_AllAge_Expedition16', 'W_AllAge_Expedition16Small', 'W_AllAge_Expedition24Tiny']
		},
		SummerBonus: {
			icon: 'R_MultiAge_SummerBonus19h',
			ids: ['R_MultiAge_SummerBonus19h'],
			specialKitIds: [
				'selection_kit_crows_nest',
				'upgrade_kit_crows_nest',
				'selection_kit_epic_SUM25',
				'selection_kit_epic_SUM24',
				'selection_kit_epic_SUM23'
			],
			kitsPerBuilding: 8
		}
	},


	/**
	 * Get building icon URL from entity ID
	 *
	 * @param {string} entityId
	 * @returns {string}
	 */
	getBuildingIconUrl: (entityId) => {
		let assetId = MainParser.CityEntities[entityId]?.asset_id || entityId;
		return srcLinks.get('/city/buildings/' + assetId.replace(/^(\D_)(.*?)/, '$1SS_$2') + '.png', true);
	},


	/**
	 * Initialize the tracker widget
	 */
	init: () => {
		if ($('#building-tracker').length === 0) {
			HTML.AddCssFile('buildingtracker');

			let div = $('<div />').attr({
				id: 'building-tracker',
				class: 'game-cursor'
			});

			$('body').append(div);
			BuildingTracker.buildWidget();
		}

		BuildingTracker.SetMenuIcon();
		BuildingTracker.update();
	},


	/**
	 * Set menu button icon to premium.png
	 */
	SetMenuIcon: () => {
		let attempts = 0;
		let timer = setInterval(() => {
			let $btn = $('#buildingTracker-Btn span:first-child');
			if ($btn.length > 0) {
				$btn.css({
					'background-image': 'url(' + srcLinks.get('/shared/icons/premium.png', true) + ')',
					'background-size': '22px 22px',
					'background-position': 'center',
					'background-repeat': 'no-repeat'
				});
				clearInterval(timer);
			}
			attempts++;
			if (attempts > 25) clearInterval(timer); // give up after ~5s
		}, 200);
	},


	/**
	 * Build the widget HTML structure
	 */
	buildWidget: () => {
		let $tracker = $('#building-tracker');

		let html = '<div class="bt-header">' +
			'<span class="bt-title">' + i18n('Boxes.BuildingTracker.Title') + '</span>' +
			'<span class="bt-diamond-badge" data-count="0">' +
				'<img src="' + srcLinks.get('/shared/icons/premium.png', true) + '" alt="" />' +
				'<span class="bt-count">0</span>' +
			'</span>' +
		'</div>' +
		'<div class="bt-body">' +
			'<div class="bt-section bt-gbs"></div>' +
			'<div class="bt-section bt-buildings"></div>' +
		'</div>';

		$tracker.html(html);

		// Diamond badge click opens Productions module on premium tab
		$('#building-tracker .bt-diamond-badge').on('click', function () {
			Productions.ActiveTab = 11; // premium/diamonds tab (1-based index in tabslet)
			Productions.init();
		});
	},


	/**
	 * Toggle visibility via menu button
	 */
	toggle: () => {
		BuildingTracker.isVisible = !BuildingTracker.isVisible;
		$('#building-tracker').toggleClass('bt-hidden', !BuildingTracker.isVisible);
	},


	/**
	 * Update all tracker data
	 */
	update: () => {
		if ($('#building-tracker').length === 0) return;

		BuildingTracker.updateGreatBuildings();
		BuildingTracker.updateRegularBuildings();
		BuildingTracker.updateDiamondBadge();
	},


	/**
	 * Update Great Building levels — 5-column icon grid
	 */
	updateGreatBuildings: () => {
		let html = '';
		let cityData = Object.values(MainParser.CityMapData);

		BuildingTracker.Config.GreatBuildings.forEach(gbId => {
			let gb = cityData.find(b => b.cityentity_id === gbId && b.type === 'greatbuilding');
			let level = gb ? gb.level : 0;
			let iconUrl = BuildingTracker.getBuildingIconUrl(gbId);

			html += '<div class="bt-gb-item">' +
				'<img class="bt-icon" src="' + iconUrl + '" alt="" title="' + (MainParser.CityEntities[gbId]?.name || gbId) + '" />' +
				'<span class="bt-gb-lvl">' + level + '</span>' +
				'</div>';
		});

		$('#building-tracker .bt-gbs').html(html);
	},


	/**
	 * Update regular building counts — 3-column icon grid with aggregated counts
	 */
	updateRegularBuildings: () => {
		let html = '';
		let cityData = Object.values(MainParser.CityMapData);
		let inventory = Object.values(MainParser.Inventory);

		// Calculate special kit bonus for SummerBonus
		let specialKitCount = inventory
			.filter(item => {
				let kitId = item.item?.selectionKitId || item.item?.upgradeItemId;
				return BuildingTracker.Config.SummerBonus.specialKitIds.includes(kitId);
			})
			.reduce((sum, item) => sum + (item.inStock || 0), 0);

		let bonusBuildings = Math.floor(specialKitCount / BuildingTracker.Config.SummerBonus.kitsPerBuilding);

		// EasterBonus aggregate
		let easterCity = 0, easterInv = 0;
		BuildingTracker.Config.EasterBonus.ids.forEach(id => {
			easterCity += cityData.filter(b => b.cityentity_id === id).length;
			easterInv += inventory
				.filter(item => item.item?.cityEntityId === id)
				.reduce((sum, item) => sum + (item.inStock || 0), 0);
		});

		let easterIcon = BuildingTracker.getBuildingIconUrl(BuildingTracker.Config.EasterBonus.icon);
		html += '<div class="bt-building-item">' +
			'<img class="bt-icon" src="' + easterIcon + '" alt="" title="Easter Bonus" />' +
			'<span class="bt-building-count">' + easterCity + ' (' + easterInv + ')</span>' +
			'</div>';

		// Expedition aggregate
		let expeditionCity = 0, expeditionInv = 0;
		BuildingTracker.Config.Expedition.ids.forEach(id => {
			expeditionCity += cityData.filter(b => b.cityentity_id === id).length;
			expeditionInv += inventory
				.filter(item => item.item?.cityEntityId === id)
				.reduce((sum, item) => sum + (item.inStock || 0), 0);
		});

		let expeditionIcon = BuildingTracker.getBuildingIconUrl(BuildingTracker.Config.Expedition.icon);
		html += '<div class="bt-building-item">' +
			'<img class="bt-icon" src="' + expeditionIcon + '" alt="" title="Expedition" />' +
			'<span class="bt-building-count">' + expeditionCity + ' (' + expeditionInv + ')</span>' +
			'</div>';

		// SummerBonus (with kit bonus added to inventory)
		let summerCity = cityData.filter(b => b.cityentity_id === BuildingTracker.Config.SummerBonus.ids[0]).length;
		let summerInv = inventory
			.filter(item => item.item?.cityEntityId === BuildingTracker.Config.SummerBonus.ids[0])
			.reduce((sum, item) => sum + (item.inStock || 0), 0);
		summerInv += bonusBuildings;

		let summerIcon = BuildingTracker.getBuildingIconUrl(BuildingTracker.Config.SummerBonus.icon);
		html += '<div class="bt-building-item">' +
			'<img class="bt-icon" src="' + summerIcon + '" alt="" title="Summer Bonus" />' +
			'<span class="bt-building-count">' + summerCity + ' (' + summerInv + ')</span>' +
			'</div>';

		$('#building-tracker .bt-buildings').html(html);
	},


	/**
	 * Set diamond counter on both widget badge and menu button
	 *
	 * @param {number} count
	 */
	SetCounter: (count) => {
		let $badge = $('#building-tracker .bt-diamond-badge');
		$badge.attr('data-count', count);
		$badge.find('.bt-count').text(count);
		$badge.toggleClass('active', count > 0);

		let $menuCounter = $('#building-tracker-count');
		if (count > 0) {
			$menuCounter.text(count).show();
		} else {
			$menuCounter.hide();
		}
	},


	/**
	 * Update diamond production badge
	 */
	updateDiamondBadge: () => {
		// Ensure CityBuildingsData is populated
		if (Object.keys(MainParser.CityMapData).length > 0 &&
			Object.keys(MainParser.CityBuildingsData || {}).length === 0 &&
			typeof CityBuildings !== 'undefined') {
			CityBuildings.createBuildings();
		}

		let diamondCount = 0;
		let buildings = Object.values(MainParser.CityBuildingsData || {});

		buildings.forEach(b => {
			let hasDiamonds = false;

			if (b.production) {
				b.production.forEach(p => {
					if (p.type === 'resources' && p.resources?.premium) {
						hasDiamonds = true;
					}
				});
			}

			if (b.state?.production) {
				b.state.production.forEach(p => {
					if (p.type === 'resources' && p.resources?.premium) {
						hasDiamonds = true;
					}
				});
			}

			if (hasDiamonds) diamondCount++;
		});

		BuildingTracker.SetCounter(diamondCount);
	}
};
