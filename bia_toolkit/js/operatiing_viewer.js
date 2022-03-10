require([
  "esri/intl",
  "esri/portal/Portal",
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/WebMap", 
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/TileLayer",
  "esri/layers/ImageryLayer",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/widgets/Legend",
  "esri/widgets/Expand",
  "esri/widgets/TimeSlider",
  "esri/tasks/support/Query",
  "esri/layers/support/MosaicRule",
  "esri/renderers/RasterStretchRenderer",
  "esri/layers/support/RasterFunction",
  "esri/core/watchUtils"
], function (
  intl, Portal, OAuthInfo, identityManager,
  WebMap, MapView, FeatureLayer, TileLayer, ImageryLayer,
  GraphicsLayer,  Graphic, Legend, Expand,
  TimeSlider, Query, MosaicRule, RasterStretchRenderer, RasterFunction,
  watchUtils
) {
  intl.setLocale("us");

  var timeslider_busrouteMasterFeturelayer = null;
  var timeslider_busrouteViewFeturelayer = null;
  var timeslider_observatoryFeturelayer = null;
  var timeslider_hazard_shinsuiImagelayer = null;
  var timeslider_risk_shinsuiImagelayer = null;
  var timeslider_staffMasterTable = null;
  var timeslider_staffViewTable = null;
  var timeslider_observatoryInundationTable = null;
  var timeslider_busrouteViewGraphicsLayer = null;
  var timeslider_summaryBusrouteViewGraphicsLayer = null;

  var alltime_busrouteMasterFeturelayer = null;
  var alltime_busrouteViewFeturelayer = null;
  var alltime_OBSERVATORYFeturelayer = null;
  var alltime_OBSERVATORYInundationTable = null;
  var alltime_floodHazardTilelayer = null;
  var alltime_floodRiskTilelayer = null;
  var alltime_staffMasterTable = null;
  var alltime_staffViewTable = null;
  var alltime_summaryViewGraphicsLayer = null;

  var classificationChart = null;
  var timeSeriesChart = null;
  var inundationDepthChart = null;

  var section_staff_list = {};
  var suspended_route_ids = [];
  var summary_suspended_route_ids = [];
  var alltime_summary_suspended_route_ids = [];
  var route_features = [];

  var img_url_continue = "image/continue_arrow.png";
  var img_url_up = "image/up_arrow.png";
  var img_url_down = "image/down_arrow.png";

  //&groupID=1ddb8599dc58407f9686ab4093261dee&applicationID=Sa4aa6rGeVfPJwqh&webmapID=40caec6ef3e141adb25bf92d68adcf02

  //パラメータの読み込み
  if (location.search.match(/groupID=(.*?)(&|$)/) == null|| location.search.match(/applicationID=(.*?)(&|$)/) == null || location.search.match(/webmapID=(.*?)(&|$)/) == null) {
    changeEnable(false);
    return;
  } else {
    changeEnable(true);
  }

  var groupId = location.search.match(/groupID=(.*?)(&|$)/)[1];
  var applicationId = location.search.match(/applicationID=(.*?)(&|$)/)[1];
  var webmapId = location.search.match(/webmapID=(.*?)(&|$)/)[1];

  //メインページリンクの変更
  var link = $("#mainpage_link").attr("href");
  $("#mainpage_link").attr("href", link + "?groupID=" + groupId);

  //認証情報の初期化
  var portalUrl =  "https://www.arcgis.com/sharing";
  var info = new OAuthInfo({
    appId: applicationId,
    popup: false
  });

  identityManager.registerOAuthInfos([info]);
  identityManager.getCredential(portalUrl);

  //configの読み込み
  var json_url = "bia_toolkit_settings.json";
  var config = null;
  $.ajaxSetup({async: false});
  $.getJSON(json_url, function(json) {
    config = json;
  });
  $.ajaxSetup({async: true});

  //ストーリー選択の初期化
  var story_id = "1";
  var choise_storyId = document.getElementById("choise_storyId");
  for (var i=0;i<config["stories"].length;i++) {
    var id = config["stories"][i].story_id;
    var label = config["stories"][i].story_label;
    var option = document.createElement("calcite-dropdown-item");
    option.setAttribute('label', id);
    option.innerHTML = label;
    if (i == 0) {
      option.setAttribute('active', true);
    }
    choise_storyId.appendChild(option);
  }

  const timeslider_map = new WebMap({
    portalItem: {
      id: webmapId
    }
  });

  timeslider_busrouteViewGraphicsLayer = new GraphicsLayer();
  timeslider_map.add(timeslider_busrouteViewGraphicsLayer);

  timeslider_summaryBusrouteViewGraphicsLayer = new GraphicsLayer();
  timeslider_map.add(timeslider_summaryBusrouteViewGraphicsLayer);

  timeslider_busrouteViewGraphicsLayer.visible = true;
  timeslider_summaryBusrouteViewGraphicsLayer.visible = false;

  const timeslider_view = new MapView({
    container: "timeslider_mapviewDiv",
    map: timeslider_map, 
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: false,
        position: "top-left"
      }
    }
  });

  timeslider_view_setwidget();

  const alltime_map = new WebMap({
    portalItem: {
      id: webmapId
    }
  });

  alltime_summaryViewGraphicsLayer = new GraphicsLayer();
  alltime_map.add(alltime_summaryViewGraphicsLayer);

  const alltime_view = new MapView({
    container: "alltime_mapviewDiv",
    map: alltime_map, 
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: false,
        position: "top-left"
      }
    }
  });

  var timeSlider = new TimeSlider({
    container: "timeSliderDiv",
    view: timeslider_view,
    fullTimeExtent: {
      start: new Date(2021, 3, 1, 9, 0),
      end: new Date(2021, 11, 31, 9, 0)
    },
    playRate: 2000,
    mode: "instant",
    stops: {
      interval: {
        value: 1,
        unit: "days"
      }
    }
  });

  timeSlider.watch("values", function(values){

    if (timeslider_risk_shinsuiImagelayer == null || timeslider_hazard_shinsuiImagelayer == null ||
        timeslider_staffViewTable == null || timeslider_staffMasterTable == null) {
      return;
    }

    refreshTimesliderDiv(values[0]);

    timeslider_view.popup.close();
  });

  timeslider_map.when(async function (layers) {
    //レイヤー取得
    timeslider_busrouteMasterFeturelayer = layers.layers.find(
      value => value.title == "busroute_master");
    timeslider_busrouteViewFeturelayer = layers.layers.find(
      value => value.title == "busroute_view");
    timeslider_observatoryFeturelayer = layers.layers.find(
      value => value.title == "observatory_master");
    timeslider_observatoryFeturelayer.title = "Observatory";
    timeslider_observatoryInundationTable = layers.tables.find(
      value => value.title == "observatory_inundation");
    timeslider_hazard_shinsuiImagelayer = layers.layers.find(
      value => value.title == "flood_hazard_image");
    timeslider_hazard_shinsuiImagelayer.title = "Flood(Hazard)";
    timeslider_risk_shinsuiImagelayer = layers.layers.find(
      value => value.title == "flood_risk_image");
    timeslider_risk_shinsuiImagelayer.title = "Flood(Risk)";
    timeslider_staffMasterTable = layers.tables.find(
      value => value.title == "staff_master");
    timeslider_staffViewTable = layers.tables.find(
      value => value.title == "staff_view");

    timeslider_busrouteMasterFeturelayer.visible = false;
    timeslider_busrouteViewFeturelayer.visible = false;
    timeslider_observatoryFeturelayer.visible = true;
    timeslider_hazard_shinsuiImagelayer.visible = true;
    timeslider_risk_shinsuiImagelayer.visible = false;

    timeslider_map.reorder(timeslider_hazard_shinsuiImagelayer, 0);
    timeslider_map.reorder(timeslider_risk_shinsuiImagelayer, 1);


    //getSection_Staff_List();
    refreshTimesliderDiv(new Date(2021, 3, 1));

    //観測所選択の初期化
    var choise_observatory = document.getElementById("choise_observatory");
    var query = timeslider_observatoryFeturelayer.createQuery();
    query.where = "1=1";
    query.orderByFields = ["BASE_ID"];
    var result = await timeslider_observatoryFeturelayer.queryFeatures(query);
    var observatory = result.features;
    for (var i=0;i<observatory.length;i++) {
      var id = observatory[i]["attributes"]["BASE_ID"];
      var label = observatory[i]["attributes"]["NAME"];
      var option = document.createElement("calcite-dropdown-item");
      option.setAttribute('label', id);
      option.innerHTML = label;
      choise_observatory.appendChild(option);
    }
  });

  alltime_map.when(async function (layers) {
    //レイヤー取得
    alltime_busrouteMasterFeturelayer = layers.layers.find(
      value => value.title == "busroute_master");
    alltime_busrouteViewFeturelayer = layers.layers.find(
      value => value.title == "busroute_view");
    alltime_OBSERVATORYFeturelayer = layers.layers.find(
      value => value.title == "observatory_master");
    alltime_OBSERVATORYInundationTable = layers.tables.find(
      value => value.title == "observatory_inundation");
    alltime_floodHazardTilelayer = layers.layers.find(
      value => value.title == "flood_hazard_alltime");
    alltime_floodRiskTilelayer = layers.layers.find(
      value => value.title == "flood_risk_alltime");
    alltime_staffMasterTable = layers.tables.find(
      value => value.title == "staff_master");
    alltime_staffViewTable = layers.tables.find(
      value => value.title == "staff_view");

    alltime_busrouteMasterFeturelayer.visible = false;
    alltime_busrouteViewFeturelayer.visible = false;
    alltime_OBSERVATORYFeturelayer.visible = true;
    alltime_floodHazardTilelayer.visible = true;
    alltime_floodRiskTilelayer.visible = false;

    alltime_map.reorder(alltime_floodHazardTilelayer, 0);
    alltime_map.reorder(alltime_floodRiskTilelayer, 1);

    await getSection_Staff_List();

    getalltimeSuspend_Bus_RouteGraphic();
    drawTimeSeriesChart();
    drawInudationDepthChart();
  });

  timeslider_view.when(function() {

    //Suspend bus routesリスト選択
    timeslider_view.whenLayerView(timeslider_busrouteViewFeturelayer).then(function(layerView) {

      $('body').on('click', '#inundation-depth-list li', function(e){
        observatory_feature_highlight(e);
      });

      $('body').on('click', '#supend-busroute-list li', function(e){

        for (let li of $('li')) {
          li.classList.remove("li_selected");
        }
        e.preventDefault();
        e.target.classList.add("li_selected");
        route_feature_highlight(e);
      });

      function observatory_feature_highlight(event) {
        let id = event.target.id;

        if (event.target.tagName != "LI") {
          id = event.target.parentElement.id;
        }

        if (id == "") return;

        var query = timeslider_observatoryFeturelayer.createQuery();
        query.where = "BASE_ID=" + id;

        timeslider_observatoryFeturelayer.queryFeatures(query).then(function(result) {

          var feature = result.features[0];

          timeslider_view.goTo(
            {
              target: feature.geometry
            },
            {
              duration: 1000,
              easing: "in-out-expo"
            }
          ).catch(function(error){
            if (error.name != "AbortError"){
              console.log(error);
            }
          });
        });
      }

      function route_feature_highlight(event) {
        let value = event.target.id.split(',');

        var query = timeslider_busrouteViewFeturelayer.createQuery();
        query.where = "STORY_ID = " + story_id + " AND ROUTE_ID=" + value[0] + " AND OPERATINGDAY ='" + value[1] + "'";

        timeslider_busrouteViewFeturelayer.queryFeatures(query).then(function(result) {

          var feature = result.features[0];

          feature.popupTemplate = timeslider_busrouteViewFeturelayer.popupTemplate;
          layerView.view.popup.highlightEnabled = true;

          layerView.view.popup.open({
            features: [feature],
            featureMenuOpen: false,
            updateLocationEnabled: false
          });

          timeslider_view.goTo(
            {
              target: feature.geometry
            },
            {
              duration: 1000,
              easing: "in-out-expo"
            }
          ).catch(function(error){
            if (error.name != "AbortError"){
              console.log(error);
            }
          });
        });
      }
    });
  });

  function refreshTimesliderDiv(date) {
    $('#timeSliderValue').text((date.getMonth()+1) + "/" + date.getDate());
    shinsuiFeaturelayer_query(date);
    shinsuiImagelayer_query(date);
    drawClassificationChart(date);
    suspendlist_query(date);
    getSuspend_Bus_RouteGraphic(date);
    absenceleaders_query(date);
    OBSERVATORY_inundation_query(date);
  }

  function timeslider_view_setwidget() {
    var lgExpand = new Expand({
      view: timeslider_view,
      expanded: false,
      mode : "floating"
    });
    timeslider_view.ui.add(lgExpand, "bottom-right");

    var legend = new Legend({
      view: timeslider_view,
      respectLayerVisibility: true
    });

    lgExpand.content = legend;
  }

  //設定変更時
  $("#setting").on("calciteDropdownSelect", function(e) {
    //表示モードの切り替え処理
    var showMode = $("#choise_showMode").children();
    for (var i = 0; i < showMode.length; i++) {
      if (showMode[i].active == true) {
        change_showMode(showMode[i].textContent);
      }
    }

    //シナリオIDの切り替え処理
    var showStoryId = $("#choise_storyId").children();
    for (var i = 0; i < showStoryId.length; i++) {
      if (showStoryId[i].active == true) {
        story_id = showStoryId[i].label;
        change_storyId(showStoryId[i].label); 
      }
    }

    //Flood表示モードの切り替え
    var floodMode= $("#choise_floodMode").children();
    for (var i = 0; i < floodMode.length; i++) {
      if (floodMode[i].active == true) {
        change_floodMode(floodMode[i].textContent); 
      }
    }

    //利用可否表示モードの切り替え
    var avalableMode= $("#choise_avalableMode").children();
    for (var i = 0; i < avalableMode.length; i++) {
      if (avalableMode[i].active == true) {
        change_avalableMode(avalableMode[i].textContent); 
      }
    }
  });

  function change_showMode(showMode) {
    if (showMode == "Time Slider") {
      $('#body1Div').addClass("body-active");
      $('#body1Div').removeClass("body-nonactive");
      $('#body2Div').addClass("body-nonactive");
      $('#body2Div').removeClass("body-active");
    } else {
      $('#body1Div').addClass("body-nonactive");
      $('#body1Div').removeClass("body-active");
      $('#body2Div').addClass("body-active");
      $('#body2Div').removeClass("body-nonactive");
    }
  }

  function change_storyId(story_id) {
    //イメージサービスのURL変更
    timeslider_hazard_shinsuiImagelayer.url = config["stories"].find(value => value.story_id == Number(story_id)).shinsuiImage_url;
    timeslider_risk_shinsuiImagelayer.url = config["stories"].find(value => value.story_id == Number(story_id)).shinsuiImage_url;

    var id = config["stories"].find(value => value.story_id == Number(story_id)).alltime_shinsui_hazard_id;

    var visible = alltime_floodHazardTilelayer.visible;
    alltime_map.layers.remove(alltime_floodHazardTilelayer);
    alltime_floodHazardTilelayer = new TileLayer({
      portalItem: {
        id: id
      }
    });
    alltime_map.layers.add(alltime_floodHazardTilelayer, 0);
    alltime_floodHazardTilelayer.visible = visible;

    id = config["stories"].find(value => value.story_id == Number(story_id)).alltime_shinsui_risk_id;
    visible = alltime_floodRiskTilelayer.visible;
    alltime_map.layers.remove(alltime_floodRiskTilelayer);
    alltime_floodRiskTilelayer = new TileLayer({
      portalItem: {
        id: id
      }
    });
    alltime_map.layers.add(alltime_floodRiskTilelayer, 0);
    alltime_floodRiskTilelayer.visible = visible;

    refreshTimesliderDiv(timeSlider.values[0]);
    timeslider_view.popup.close();

    drawTimeSeriesChart();
    drawInudationDepthChart();
  }

  function change_floodMode(floodMode){
    if (floodMode == "Flood(Hazard)") {
      timeslider_hazard_shinsuiImagelayer.visible = true;
      timeslider_risk_shinsuiImagelayer.visible = false;
      alltime_floodHazardTilelayer.visible = true;
      alltime_floodRiskTilelayer.visible = false;
    } else if (floodMode == "Flood(Risk)") {
      timeslider_hazard_shinsuiImagelayer.visible = false;
      timeslider_risk_shinsuiImagelayer.visible = true;
      alltime_floodHazardTilelayer.visible = false;
      alltime_floodRiskTilelayer.visible = true;
    } else {
      timeslider_hazard_shinsuiImagelayer.visible = false;
      timeslider_risk_shinsuiImagelayer.visible = false;
      alltime_floodHazardTilelayer.visible = false;
      alltime_floodRiskTilelayer.visible = false;
    }
  }

  function change_avalableMode(avalableMode){
    if (avalableMode == "Bus(Summary)") {
      timeslider_summaryBusrouteViewGraphicsLayer.visible = true;
      timeslider_busrouteViewGraphicsLayer.visible = false;
    } else {
      timeslider_summaryBusrouteViewGraphicsLayer.visible = false;
      timeslider_busrouteViewGraphicsLayer.visible = true;
    }
  }

  //Display Rateのチェック
  $('#check_rate').on('change', function(){
    drawClassificationChart(timeSlider.values[0]);
  });

  //チャートの切り替え
  $('body').on('click', '.tab' , function() {
    $('.is-active').removeClass('is-active');
    $(this).addClass('is-active');
    $('.is-show').removeClass('is-show');
    const index = $(this).index();
    $('.panel').eq(index).addClass('is-show');
  });

  //セクションごとの従業員数を取得
  async function getSection_Staff_List() {

    var query = alltime_staffMasterTable.createQuery();

    query.where = "1=1";
    query.outFields = [
      "STAFF_SECTION"
    ];

    query.groupByFieldsForStatistics = "STAFF_SECTION";
    query.orderByFields = "STAFF_SECTION";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    var response = await alltime_staffMasterTable.queryFeatures(query);
    var features = response.features;

    for(var i = 0; i< features.length; i++) {
      var domainlist = response.fields.find(key => key.name=="STAFF_SECTION").domain.codedValues;
      var section = features[i].attributes["STAFF_SECTION"];

      var section_domain = domainlist.find(value => value.code == section);
      var section_name = "Non Section";
      if (section_domain != null) {
        section_name = section_domain.name;
      } 

      var count = features[i].attributes["カウント"];
      section_staff_list[section_name] = count;
    }
  }

  function shinsuiFeaturelayer_query(date){

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    timeslider_busrouteViewFeturelayer.definitionExpression = "OPERATINGDAY = '" + str_date + "'";

  }

  function shinsuiImagelayer_query(date){

    var mr = new MosaicRule({
      where: "NAME='" + formatDate(date, 'yyyyMMdd') + "'"
    }); 
    timeslider_risk_shinsuiImagelayer.mosaicRule = mr;
    timeslider_hazard_shinsuiImagelayer.mosaicRule = mr;

  }

  function drawClassificationChart(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    var query = timeslider_staffViewTable.createQuery();

    //稼働のみ
    query.where = "STORY_ID = " + story_id + " AND OPERATINGDAY = '" + str_date + "'";
    query.outFields = [
      "STAFF_SECTION"
    ];

    query.groupByFieldsForStatistics = "STAFF_SECTION";
    query.orderByFields = "STAFF_SECTION";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    timeslider_staffViewTable.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      var available_list = {};
      var notavailable_list = {};
      var labels = [];
      var available_count = [];
      var notavailable_count = [];

      var display_rate = false;
      if ($('#check_rate:checked').val() != null) {
        display_rate = true;
      }

      //初期化
      labels = Object.keys(section_staff_list);
      for (var i = 0; i< labels.length; i++) {
        if (display_rate == true) {
          available_list[labels[i]] = 100;
          notavailable_list[labels[i]] = 0;
        } else {
          available_list[labels[i]] = section_staff_list[labels[i]];
          notavailable_list[labels[i]] = 0;
        }
      }

      //件数の取得
      for(var i = 0; i< features.length; i++) {
        var domainlist = response.fields.find(key => key.name=="STAFF_SECTION").domain.codedValues;
        var section = features[i].attributes["STAFF_SECTION"];

        var section_domain = domainlist.find(value => value.code == section);
        var section_name = "Non Section";
        if (section_domain != null) {
          section_name = section_domain.name;
        } 

        var count = features[i].attributes["カウント"];

        if (display_rate == true) {
          notavailable_list[section_name] = Math.floor(100 *  count / section_staff_list[section_name]);
          available_list[section_name] = 100 - notavailable_list[section_name];
        } else {
          notavailable_list[section_name] = count;
          available_list[section_name] = section_staff_list[section_name] - count;
        }
      }

      available_count = Object.values(available_list);
      notavailable_count = Object.values(notavailable_list);

      update_classificationChart(labels, available_count, notavailable_count);

    });

  }

  function update_classificationChart(labels, available_count, notavailable_count){

    var ctx = document.getElementById("classificationChartCanvas").getContext('2d');

    if (classificationChart != null) {
      classificationChart.destroy();
    }

    var display_rate = false;
    if ($('#check_rate:checked').val() != null) {
      display_rate = true;
    }

    var xlabel = "People";
    var xUnit = "";
    var xStepSize = 50;

    if (display_rate == true) {
      xlabel = "Rate";
      xUnit = "%";
      xStepSize = 50;
    }

    var datasets = [];

    datasets.push({
      data: available_count,
      backgroundColor: "rgba(100,255,150,0.5)"
    });

    datasets.push({
      data: notavailable_count,
      backgroundColor: "rgba(255,0,0,0.5)"
    });

    var yLabel = "";

    classificationChart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        title: {
          display: false
        },
        layout: {
          padding: {
            left: 0,
            right: 20,
            top: 20,
            bottom: 20
          }
        },
        legend: {
          display: false
        },
        tooltips: {
          enabled: false
        },
        hover: {
          animationDuration: 0
        },
        animation: {
          duration: 1,
          onComplete: function () {
            var chartInstance = this.chart;
            var ctx = chartInstance.ctx;
            ctx.textAlign = "left";
            ctx.font = "12px Open Sans";
            ctx.fillStyle = "#fff";

            Chart.helpers.each(this.data.datasets.forEach(function (dataset, i) {
              var meta = chartInstance.controller.getDatasetMeta(i);
              Chart.helpers.each(meta.data.forEach(function (bar, index) {

                if(i==0){
                  data = " " + dataset.data[index] + xUnit + " Commuting";
                  ctx.fillText(data, bar._model.base, bar._model.y+4);
                } else {
                  data = " " + dataset.data[index] + xUnit + " Not Commuting ";
                  ctx.fillText(data, bar._model.base, bar._model.y+4);
                }
              }),this)
            }),this);
          }
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: true,
              labelString: xlabel,
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              stepSize: xStepSize,
              callback: function(value, index, values){
                return  value
              }
            },
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: "Section",
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              userCallback: function(label, index, labels) {
                if (label == null) {
                  return "No Type"
                } else {
                  return label
                }
              }
            } 
          }]
        },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }


  async function drawTimeSeriesChart() {

    //グラフのクリア
    var chartTab = $('#timeSeriesChartTab');
    var cahrtDiv = $('#timeSeriesChartDiv');
    chartTab.empty();
    cahrtDiv.empty();

    var query = alltime_staffViewTable.createQuery();

    query.where = "STORY_ID = " + story_id ;
    query.outFields = [
      "STAFF_SECTION"
    ];

    query.groupByFieldsForStatistics = "STAFF_SECTION";
    query.orderByFields = "STAFF_SECTION";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    //Base_type=ALL
    await drawTimeSeriesChart_PerSection();

    alltime_staffViewTable.queryFeatures(query)
      .then(async function(response){
      var features = response.features;

      for(var i = 0; i< features.length; i++) {
        var staff_section = features[i].attributes["STAFF_SECTION"];
        await drawTimeSeriesChart_PerSection(staff_section);
      }
    });

  }

  //function drawTimeSeriesChart() {
  async function drawTimeSeriesChart_PerSection(staff_section) {

    var query = alltime_staffViewTable.createQuery();

    //Base_type=ALL
    if (staff_section == null) {
      query.where = "STORY_ID = " + story_id;
      query.outFields = [
        "OPERATINGDAY"
      ];
      query.groupByFieldsForStatistics = "OPERATINGDAY";
    } else {
      query.where = "STORY_ID = " + story_id + " AND STAFF_SECTION = '" + staff_section + "'";
      query.outFields = [
        "STAFF_SECTION,OPERATINGDAY"
      ];
      query.groupByFieldsForStatistics = "STAFF_SECTION,OPERATINGDAY";
    }

    query.returnGeometry = false;
    query.orderByFields = [
      "OPERATINGDAY"
    ];

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    alltime_staffViewTable.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      var available_list = {};
      var notavailable_list = {};
      var labels = [];
      var available_count = [];
      var notavailable_count = [];

      var title = staff_section;
      if (staff_section == null) {
        title = "ALL";
      } else {
        var domainlist = response.fields.find(key => key.name=="STAFF_SECTION").domain.codedValues;
        title = domainlist.find(key => key.code == staff_section).name;
      }

      var section_staff_counts = Object.values(section_staff_list);
      var staff_count = 0;
      for (var i=0; i<section_staff_counts.length;i++) {
        staff_count = staff_count + section_staff_counts[i];
      }

      //初期化
      var min = new Date(2021, 3, 1);
      var max = new Date(features[features.length-1].attributes["OPERATINGDAY"]);
      var current = min;
      while(current <= max) {
        var date_txt = formatDate(current, "MM/dd");
        if (labels.indexOf(date_txt) == -1) {
          labels.push(date_txt);

          if (staff_section == null) {
            available_list[date_txt] = staff_count;
          } else {
            available_list[date_txt] = section_staff_list[title];
          }
          notavailable_list[date_txt] = 0;
        }

        var newDate = current.setDate(current.getDate() + 1);
        current = new Date(newDate);
      }

      //件数の取得
      for(var i = 0; i< features.length; i++) {
        var section = features[i].attributes["STAFF_SECTION"];
        var date = new Date(features[i].attributes["OPERATINGDAY"]);
        var date_txt = formatDate(date, "MM/dd");
        var count = features[i].attributes["カウント"];

        notavailable_list[date_txt] = count;
        available_list[date_txt] = available_list[date_txt] - count; 
      }

      available_count = Object.values(available_list);
      notavailable_count = Object.values(notavailable_list);

      update_timeSeriesChart(section, title, labels, available_count, notavailable_count);

    });

  }

  function update_timeSeriesChart(section, title, labels, available_count, notavailable_count){

    var chartTab = $('#timeSeriesChartTab');
    var cahrtDiv = $('#timeSeriesChartDiv');
    var panel_id = 'timeSeriasePanel_' + section;

    if (title == "ALL") {
      chartTab.append('<li class="tab is-active">' + title + '</li>');
      cahrtDiv.append('<div id="' + panel_id + '" class="panel is-show"/>');
    } else {
      chartTab.append('<li class="tab">' + title + '</li>');
      cahrtDiv.append('<div id="' + panel_id + '" class="panel"/>');
    }

    //Canvas生成
    var canvas_id = 'timeSeriaseChart_' + section;
    element = $('<canvas id="' + canvas_id + '" />');
    $('#' + panel_id).append(element); 

    var ctx = document.getElementById(canvas_id).getContext('2d');

    var datasets = [];

    datasets.push({
      label: "Commuting People",
      data: available_count,
      backgroundColor: "rgba(100,255,150,0.8)"
    });

    datasets.push({
      label: "Not Commuting People",
      data: notavailable_count,
      backgroundColor: "rgba(255,0,0,0.8)"
    });

    var yLabel = "";

    timeSeriesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        title: {
          display: false,
          fontSize: 11,
          fontFamily: "sans-serif",
          text: title
        },
        layout: {
          padding: {
            left: 0,
            right: 20,
            top: 20,
            bottom: 20
          }
        },
        legend: {
          display: false
        },
        tooltips: {
          enabled: true
        },
        hover: {
          animationDuration: 0
        },
        scales: {
          xAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: "Time"
            },
            ticks: {
              display: true, 
              callback: function(value, index, values){
                return value
              },
              autoSkip: true,
              maxTicksLimit: 2
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: title,
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              userCallback: function(label, index, labels) {
                return label
              }
            },
            stacked: true
          }]
        },
        responsive: true,
        maintainAspectRatio: true
      }
    });
  }

  async function drawInudationDepthChart() {

    var actives = [];
    var list = $("#choise_observatory").children();
    for (var i = 0; i < list.length; i++) {
      if (list[i].active == true) {
        actives.push(list[i].label);
      }
    }

    var query = alltime_OBSERVATORYInundationTable.createQuery();

    query.where = "STORY_ID = " + story_id;

    if (actives.length > 0) {
      query.where += " AND BASE_ID IN ('" + actives.join("','") + "')";
    } else {
      query.where += " AND 1<>1";
    }
    query.outFields = [
      "BASE_ID"
    ];
    query.groupByFieldsForStatistics = "BASE_ID";
    query.orderByFields = "BASE_ID";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    var response = await alltime_OBSERVATORYInundationTable.queryFeatures(query);
    drawInudationDepthPerBaseIdChart(response);
  }

  async function drawInudationDepthPerBaseIdChart(response) {
    var features = response.features;

    var inudation_dataset = [];
    for (var i=0;i<features.length;i++) {
      var base_id = features[i].attributes["BASE_ID"];

      var query = alltime_OBSERVATORYInundationTable.createQuery();
      query.where = "STORY_ID = " + story_id + " AND BASE_ID = " + base_id;
      query.outFields = [
        "BASE_ID,OPERATINGDAY,INUNDATION_DEPTH"
      ];
      query.orderByFields = "OPERATINGDAY";

      var response1 = await alltime_OBSERVATORYInundationTable.queryFeatures(query);
      var features1 = response1.features;

      var label_list = {};
      var inudation_list = {};
      var label_dataset = null;

      for (var j=0;j<features1.length;j++) {
        var base_id = features1[j].attributes["BASE_ID"];
        var date = new Date(features1[j].attributes["OPERATINGDAY"]);
        var date_txt = formatDate(date, "MM/dd");

        var value = features1[j].attributes["INUNDATION_DEPTH"];
        var value_txt = Math.round(value*10000) / 10000;

        label_list[date] = date_txt;
        inudation_list[date] = value_txt;
      }

      label_dataset = Object.values(label_list);
      inudation_dataset.push({
        id: base_id,
        data: Object.values(inudation_list)
      });

    }
    update_InudationDepthChart(label_dataset, inudation_dataset)
  }


  function update_InudationDepthChart(labels, inudations){

    if (inundationDepthChart != null) {
      inundationDepthChart.destroy();
    }

    var ctx = document.getElementById("inundationDepthChartCanvas");
    var datasets = [];
    var colors = [
      "rgba(255,0,0,1)",
      "rgba(0,0,255,1)",
      "rgba(0,255,0,1)",
      "rgba(255,0,255,1)",
    ];

    for (var i=0;i<inudations.length;i++) {
      datasets.push({
        label: inudations[i].id,
        fill: false,
        borderWidth: 1, 
        data: inudations[i].data,
        pointRadius: 0,
        borderColor: colors[i%colors.length] 
      });  
    }
    var yLabel = "";

    inundationDepthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        title: {
          display: false,
          fontSize: 11,
          fontFamily: "sans-serif",
          text: "Inudation Depth"
        },
        layout: {
          padding: {
            left: 0,
            right: 20,
            top: 20,
            bottom: 0
          }
        },
        legend: {
          display: true
        },
        tooltips: {
          enabled: true,
          mode: 'index'
        },
        hover: {
          animationDuration: 0
        },
        scales: {
          xAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: "Time"
            },
            ticks: {
              display: true, 
              callback: function(value, index, values){
                return value
              },
              autoSkip: true,
              maxTicksLimit: 2
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: "Inudation Depth(m)",
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              userCallback: function(label, index, labels) {
                return label
              },
              //suggestedMax: 5.00,
              suggestedMin: 0.00,
              stepSize: 0.5
            },
            stacked: false
          }]
        },
        responsive: true,
        //maintainAspectRatio: true
      }
    });
  }


  function absenceleaders_query(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    var query = timeslider_staffViewTable.createQuery();

    query.where = "STORY_ID = " + story_id + "AND OPERATINGDAY = '" + str_date + "' AND LEADER = 1";
    query.outFields = [
      "*"
    ];
    query.orderByFields = "STAFF_ID";

    timeslider_staffViewTable.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      $('#absence-of-leaders-list').empty();

      for(var i = 0; i< features.length; i++) {
        var sectionfield = response.fields.find(value => value.name == "STAFF_POSITION");
        var positionfield = response.fields.find(value => value.name == "STAFF_SECTION");
        var sectiondomain = sectionfield.domain.codedValues;
        var positiondomain = positionfield.domain.codedValues;

        var staff_id = features[i].attributes["STAFF_ID"];
        var name = features[i].attributes["NAME"];
        var staff_section = features[i].attributes["STAFF_SECTION"];
        var staff_position = features[i].attributes["STAFF_POSITION"];
        var section_domain = sectiondomain.find(value => value.code == staff_section);
        var section_name = "Non Section";
        if (section_domain != null) {
          section_name = section_domain.name;
        }

        var staff_position = features[i].attributes["STAFF_POSITION"];

        var position_domain = positiondomain.find(value => value.code == staff_position);
        var position_name = "Non Position";
        if (position_domain != null) {
          position_name = position_domain.name;
        }

        $('#absence-of-leaders-list').append('<li>Section:' + section_name + ' Position:' + position_name + '<br>STAFF:' + staff_id + ' NAME:' + name + '</li>');
      }
    });

  }

  //観測所ごとの浸水深表示
  async function OBSERVATORY_inundation_query(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();
    var before_date = new Date(date.getTime());
    before_date.setDate(before_date.getDate() - 1);
    var str_before_date = before_date.getFullYear() + "/" + (before_date.getMonth()+1) + "/" + before_date.getDate();

    var actives = [];
    var list = $("#choise_observatory").children();
    for (var i = 0; i < list.length; i++) {
      if (list[i].active == true) {
        actives.push(list[i].label);
      }
    }

    var query = timeslider_observatoryInundationTable.createQuery();

    query.where = "STORY_ID = " + story_id 
    query.where += " AND (OPERATINGDAY = '" + str_date + "' OR OPERATINGDAY = '" + str_before_date + "')";

    if (actives.length > 0) {
      query.where += " AND BASE_ID IN ('" + actives.join("','") + "')";
      timeslider_observatoryFeturelayer.definitionExpression = "BASE_ID IN ('" + actives.join("','") + "')";
      alltime_OBSERVATORYFeturelayer.definitionExpression = "BASE_ID IN ('" + actives.join("','") + "')";
    } else {
      query.where += " AND 1<>1";
      timeslider_observatoryFeturelayer.definitionExpression = "1<>1";
      alltime_OBSERVATORYFeturelayer.definitionExpression = "1<>1";
    }

    query.outFields = [
      "*"
    ];
    query.orderByFields = "BASE_ID,OPERATINGDAY";
    query.returnGeometry = false;

    var response = await timeslider_observatoryInundationTable.queryFeatures(query);
    var features = response.features;

    var observatory_list = {}
    var depth_list = {}
    var diff_depth_list = {}

    $('#inundation-depth-list').empty();

    //観測所ごとの浸水深を取得
    for(var i = 0; i< features.length; i++) {
      var base_id = features[i].attributes["BASE_ID"];
      var depth = features[i].attributes["INUNDATION_DEPTH"];
      var round_depth = Math.round(depth*100) / 100;
      var operatingday = new Date(features[i].attributes["OPERATINGDAY"]);

      var str_operatingday = operatingday.getFullYear() + "/" + (operatingday.getMonth()+1) + "/" + operatingday.getDate();

      if ((base_id in depth_list) == false) {
        depth_list[base_id] = 0;
        diff_depth_list[base_id] = 0;
      }

      if (str_operatingday == str_date) {
        depth_list[base_id] = round_depth;
        diff_depth_list[base_id] += depth;
      } else {
        diff_depth_list[base_id] -= depth;
      }
    }

    query = timeslider_observatoryFeturelayer.createQuery();

    query.where = "1=1";
    query.outFields = [
      "*"
    ];
    query.orderByFields = "BASE_ID";
    query.returnGeometry = false;

    var response = await timeslider_observatoryFeturelayer.queryFeatures(query);
    var features = response.features;

    //観測所名を取得
    for(var i = 0; i< features.length; i++) {
      var base_id = features[i].attributes["BASE_ID"];
      var name = features[i].attributes["NAME"];
      observatory_list[base_id] = name;
    }

    //観測所ごとの浸水深を表示
    for(var base_id in observatory_list) {
      if(observatory_list.hasOwnProperty(base_id) && depth_list.hasOwnProperty(base_id) && diff_depth_list.hasOwnProperty(base_id)) {
        var name = observatory_list[base_id];
        var depth = depth_list[base_id];
        var diff = diff_depth_list[base_id];

        var list_html = '<li id="' + base_id + '" class="inundation-depth-panel">';

        if (diff == 0) {
          list_html += '<img src="' + img_url_continue + '" class="inundation-depth-image"/>'
        } else if (diff > 0) {
          list_html += '<img src="' + img_url_up + '" class="inundation-depth-image"/>'
        } else if (diff < 0) {
          list_html += '<img src="' + img_url_down + '" class="inundation-depth-image"/>'
        }

        list_html += '<span>OBSERVATORY:　' + base_id + ":" + name + '<br>INUNDATION_DEPTH:　' + depth + '</span>'
        list_html += '</li>';

        $('#inundation-depth-list').append(list_html);
      }
    }
  }

  function suspendlist_query(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    var query = timeslider_busrouteViewFeturelayer.createQuery();

    query.where = "STORY_ID = " + story_id + "AND OPERATINGDAY = '" + str_date + "'";
    query.outFields = [
      "*"
    ];
    query.orderByFields = "ROUTE_ID";
    query.returnGeometry = false;

    timeslider_busrouteViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      $('#supend-busroute-list').empty();
      suspended_route_ids = [];

      for(var i = 0; i< features.length; i++) {
        var domainlist = response.fields.find(key => key.name=="BUS_TYPE").domain.codedValues;
        var route_id = features[i].attributes["ROUTE_ID"];
        suspended_route_ids.push(route_id);

        var name = features[i].attributes["NAME"];
        var bus_type = features[i].attributes["BUS_TYPE"];
        var bus_type_domain = domainlist.find(value => value.code == bus_type);
        var bus_type_name = "Non Type";
        if (bus_type_domain != null) {
          bus_type_name = bus_type_domain.name;
        } 
        var depth = features[i].attributes["INUNDATION_DEPTH"];
        var operatingday = new Date(features[i].attributes["OPERATINGDAY"]);

        var str_operatingday = operatingday.getFullYear() + "/" + (operatingday.getMonth()+1) + "/" + operatingday.getDate();

        $('#supend-busroute-list').append('<li id="' + route_id + ',' + str_operatingday + '">BusRoute:' + route_id + ' ' + name + '<br>TYPE:' + bus_type_name + '<br/>INUNDATION_DEPTH:' + depth + '</li>');
      }

      suspend_route_addgraphic();
    });
  }

  function suspend_route_addgraphic(){

    var query = timeslider_busrouteMasterFeturelayer.createQuery();
    query.where = "1=1";
    query.outFields = ["ROUTE_ID"];
    //query.maxAllowableOffset = 0.001;

    timeslider_busrouteMasterFeturelayer.queryFeatures(query)
      .then(function(response){

      timeslider_busrouteViewGraphicsLayer.removeAll();

      var features = response.features;

      for(var i = 0; i< features.length; i++) {
        var route_id = features[i].attributes["ROUTE_ID"];

        var graphic = features[i];
        graphic.symbol = {
          type: "simple-line",
          color: "green",
          width: "2px",
          style: "solid"
        };

        if (suspended_route_ids.indexOf(route_id) != -1) {
          graphic.symbol.color = "red"; 
        }

        timeslider_busrouteViewGraphicsLayer.add(graphic);
      }
    });
  }

  function getSuspend_Bus_RouteGraphic(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    var query = timeslider_busrouteViewFeturelayer.createQuery();
    query.where = "STORY_ID = " + story_id + "AND OPERATINGDAY <= '" + str_date + "'";
    query.outFields = [
      "ROUTE_ID"
    ];
    query.returnGeometry = false;

    query.groupByFieldsForStatistics = "ROUTE_ID";
    query.orderByFields = "ROUTE_ID";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    timeslider_busrouteViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      summary_suspended_route_ids = {};

      for(var i = 0; i< features.length; i++) {
        var route_id = features[i].attributes["ROUTE_ID"];
        var count = features[i].attributes["カウント"];
        summary_suspended_route_ids[route_id] = count;
      }

      summary_notavailableroute_addgraphic();
    });
  }

  function summary_notavailableroute_addgraphic(){

    var query = timeslider_busrouteMasterFeturelayer.createQuery();
    query.where = "1=1";
    query.outFields = ["ROUTE_ID, NAME"];

    timeslider_busrouteMasterFeturelayer.queryFeatures(query)
      .then(function(response){

      timeslider_summaryBusrouteViewGraphicsLayer.removeAll();

      var features = response.features;

      for(var i = 0; i< features.length; i++) {
        var route_id = features[i].attributes["ROUTE_ID"];

        var graphic = features[i];
        graphic.symbol = {
          type: "simple-line",
          color: "green",
          width: "2px",
          style: "solid"
        };

        var route_ids = Object.keys(summary_suspended_route_ids);

        if (route_ids.indexOf(route_id) == -1) {
          graphic.attributes["COUNT"] = summary_suspended_route_ids[route_id];

          if (summary_suspended_route_ids[route_id] > 180) { 
            graphic.symbol.color = "red";
          } else if (summary_suspended_route_ids[route_id] > 150) { 
            graphic.symbol.color = "orange";
          } else if (summary_suspended_route_ids[route_id] > 120) { 
            graphic.symbol.color = "yellow";
          } else { 
            graphic.symbol.color = "green";
          }             
        } else {
          graphic.attributes["COUNT"] = 0;
        }

        graphic.popupTemplate = {
          title: "{NAME}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "ROUTE_ID",
                  label: "ROUTE_ID"
                },
                {
                  fieldName: "NAME",
                  label: "NAME"
                },
                {
                  fieldName: "COUNT",
                  label: "Suspend Days"
                }
              ]
            }
          ]
        };

        timeslider_summaryBusrouteViewGraphicsLayer.add(graphic);
      }
    });
  }

  function getalltimeSuspend_Bus_RouteGraphic() {

    var query = alltime_busrouteViewFeturelayer.createQuery();

    query.where = "STORY_ID = " + story_id;
    query.outFields = [
      "ROUTE_ID"
    ];
    query.returnGeometry = false;

    query.groupByFieldsForStatistics = "ROUTE_ID";
    query.orderByFields = "ROUTE_ID";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    alltime_busrouteViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      alltime_summary_suspended_route_ids = {};

      for(var i = 0; i< features.length; i++) {
        var route_id = features[i].attributes["ROUTE_ID"];
        var count = features[i].attributes["カウント"];
        alltime_summary_suspended_route_ids[route_id] = count;
      }

      alltime_summary_notavailableroute_addgraphic();
    });
  }

  function alltime_summary_notavailableroute_addgraphic(){

    var query = timeslider_busrouteMasterFeturelayer.createQuery();
    query.where = "1=1";
    query.outFields = ["ROUTE_ID, NAME"];

    timeslider_busrouteMasterFeturelayer.queryFeatures(query)
      .then(function(response){

      alltime_summaryViewGraphicsLayer.removeAll();

      var features = response.features;

      for(var i = 0; i< features.length; i++) {
        var route_id = features[i].attributes["ROUTE_ID"];

        var graphic = features[i];
        graphic.symbol = {
          type: "simple-line",
          color: "green",
          width: "2px",
          style: "solid"
        };

        var route_ids = Object.keys(alltime_summary_suspended_route_ids);

        if (route_ids.indexOf(route_id) == -1) {
          graphic.attributes["COUNT"] = alltime_summary_suspended_route_ids[route_id];

          if (alltime_summary_suspended_route_ids[route_id] > 180) { 
            graphic.symbol.color = "red";
          } else if (alltime_summary_suspended_route_ids[route_id] > 150) { 
            graphic.symbol.color = "orange";
          } else if (alltime_summary_suspended_route_ids[route_id] > 120) { 
            graphic.symbol.color = "yellow";
          } else { 
            graphic.symbol.color = "green";
          }             
        } else {
          graphic.attributes["COUNT"] = 0;
        }

        graphic.popupTemplate = {
          title: "{NAME}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "ROUTE_ID",
                  label: "ROUTE_ID"
                },
                {
                  fieldName: "NAME",
                  label: "NAME"
                },
                {
                  fieldName: "COUNT",
                  label: "Suspend Days"
                }
              ]
            }
          ]
        };
        alltime_summaryViewGraphicsLayer.add(graphic);
      }
    });
  }

  function changeEnable(enable) {
    if (enable) {
      $("#mainDiv").show();
      $("#disableDiv").hide();
    } else {
      $("#mainDiv").hide();
      $("#disableDiv").show();
    }
  }

  function formatDate(date, format) {
    format = format.replace(/yyyy/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
    format = format.replace(/SSS/g, ('00' + date.getMilliseconds()).slice(-3));
    return format;
  };
});

const wait = (sec) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, sec*1000);
  });
};