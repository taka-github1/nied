require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Basemap",
  "esri/layers/ImageryLayer",
  "esri/layers/MapImageLayer",
  "esri/layers/WebTileLayer",
  "esri/rest/support/ImageIdentifyParameters",
  "esri/widgets/Expand",
  "esri/widgets/TimeSlider",
  "esri/request",
  "dojo/promise/all"
], (
  Map,
  MapView,
  Basemap,
  ImageryLayer,
  MapImageLayer,
  WebTileLayer,
  ImageIdentifyParameters,
  Expand,
  TimeSlider,
  esriRequest,
  all
) => {

  /** 
   * 凡例およびポップアップ用の設定リスト
   * legend.html の class="legendDiv_"と対応している
   * 各要素の2番目と3番目は、それぞれポップアップのタイトルと数値に付ける単位
   */
  const legendList = [
    ["rain", "1時間降水量", "mm/h"],
    ["flood", "浸水深", "m"],
    ["Road", "", ""],
    ["Tatemono", "", ""],
    ["R24H", "24時間降水量", "mm"],
    ["R48H", "48時間降水量", "mm"],
    ["R72H", "72時間降水量", "mm"],
    ["ER90M", "1.5時間実効雨量", "mm"],
    ["ER72H", "72時間実効雨量", "mm"]
  ];
  let popupTitle = "";
  let popupUnit = "";

  /** 背景地図 */
  /*
  const basemap = new Basemap({
    title: "淡色地図",
    baseLayers: [
      new WebTileLayer({
        urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/pale/{level}/{col}/{row}.png",
        copyright: "国土地理院"
      })
    ],
    thumbnailUrl: "https://cyberjapandata.gsi.go.jp/xyz/pale/12/3637/1612.png"
  });
  */
  const map = new Map({
    basemap: "hybrid"
  });
  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [138.836, 37.595],
    zoom: 7,
    popup: {
      dockEnabled: false,
      dockOptions: {
        // Disables the dock button from the popup
        buttonEnabled: false,
        // Ignore the default sizes that trigger responsive docking
        breakpoint: false
      }
    }
  });

  view.ui.add(document.getElementById("titleDiv"), "top-left");

  /**
   * ArcGIS ServerのserviceDescriptionの設定内容からレイヤー選択用のリストを作成する。
   * 「シナリオ名_テーマ名_レイヤー名」という形式であることが必要
   */
  const baseRestURL = "https://maps-dr.bosai.go.jp/webgis/rest/services/";
  const rainRestURL = "https://maps-dr.bosai.go.jp/webgis/rest/services/rain";
  const rainRestOptions = {
    query: {
      f: "json"
    },
    responseType: "json"
  };
  const scenarioSelect = document.getElementById("scenarioSelect");
  const themeSelect = document.getElementById("themeSelect");
  const layerSelect = document.getElementById("layerSelect");
  let timeEnabledLayerList = [];
  let timeEnabledLayerObjList = [];
  esriRequest(rainRestURL, rainRestOptions).then(function (response) {
    timeEnabledLayerList = response.data.services.map(rainServce => {
      if(rainServce.type == "ImageServer" || rainServce.type == "MapServer"){
        return setServiceOption(rainServce);
      }
    });
    all(timeEnabledLayerList).then(function(results) {
      results.forEach(function( timeEnabledLayer ) {
        //console.log("timeEnabledLayer:", timeEnabledLayer);
        let serviceNames = timeEnabledLayer.serviceDescription.split("_");
        let serviceUrl = timeEnabledLayer.url;
        let scenario = timeEnabledLayerObjList.find(value => value.name === serviceNames[0]);
        if (scenario) {
          //console.log(scenario.data);
          let theme = scenario.data.find(value => value.name === serviceNames[1]);
          if (theme) {
            //console.log("theme.data");
            theme.data.push({name: serviceNames[2], url: serviceUrl});
          } else {
            //console.log("テーマなし");
            scenario.data.push({name: serviceNames[1], data: [{name: serviceNames[2], url: serviceUrl}]});
          }
  
        } else {
          //console.log("シナリオなし");
          timeEnabledLayerObjList.push({name: serviceNames[0], data: [{name: serviceNames[1], data: [{name: serviceNames[2], url: serviceUrl}]}]});
        }
  
      });
      timeEnabledLayerObjList.map(scenario => {
        const scenarioOption = document.createElement("option");
        scenarioOption.text = scenario.name;
        scenarioOption.value = scenario.name;
        scenarioSelect.appendChild(scenarioOption);
        //console.log(scenarioOption);
      });
  
    });
  });
  function setServiceOption(service){
    return esriRequest(baseRestURL + service.name + "/" + service.type, rainRestOptions).then(function (response) {
      return {serviceDescription: response.data.serviceDescription, url: baseRestURL + service.name + "/" + service.type};
    });
  }

  /** 時間対応のイメージサービスまたはマップサービス */
  let timeEnabledLayer;
  const timeSlider = new TimeSlider({
    container: "timesliderDiv",
    mode: "instant",
    view: view,
    timeVisible: true, // show the time stamps on the timeslider
    loop: false
  });
  let selectedScenario;
  let zoom2layer = true; //そのシナリオで最初に選択したレイヤーのfullExtentにズームする
  scenarioSelect.addEventListener("change", () => {
    //console.log("scenarioSelect.value:", scenarioSelect.value);
    zoom2layer = true;
    if(!scenarioSelect.value) {
      return;
    }
    removeOptions(themeSelect);
    removeOptions(layerSelect);
    selectedScenario = timeEnabledLayerObjList.find(value => value.name === scenarioSelect.value);
    //console.log("selectedScenario:", selectedScenario);
    selectedScenario.data.map(theme => {
      //console.log(theme.name);
      const themeOption = document.createElement("option");
      themeOption.text = theme.name;
      themeOption.value = theme.name;
      themeSelect.appendChild(themeOption);
    });
  });
  themeSelect.addEventListener("change", () => {
    removeOptions(layerSelect);
    //console.log("themeSelect.value:", themeSelect.value);
    let selectedTheme = selectedScenario.data.find(value => value.name === themeSelect.value);
    if (!selectedTheme) {
      return;
    }
    //console.log("selectedTheme:", selectedTheme);
    selectedTheme.data.map(layer => {
      //console.log(layer.name);
      const layerOption = document.createElement("option");
      layerOption.text = layer.name;
      layerOption.value = layer.url;
      layerSelect.appendChild(layerOption);
    });
  });
  layerSelect.addEventListener("change", () => {
    document.getElementById("viewDiv").style.cursor = "wait";
    if (timeEnabledLayer) {
      map.remove(timeEnabledLayer);
    }
    if (layerSelect.value === "") {
      return;
    }
    if (layerSelect.value.includes("MapServer")) {
      timeEnabledLayer = new MapImageLayer({
        id: "timeEnabledLayer",
        url: layerSelect.value,
        opacity: 0.6,
        definitionExpression: "after_time = " + afterTime,
        visible: true
      });  
    } else if (layerSelect.value.includes("ImageServer")) {
      timeEnabledLayer = new ImageryLayer({
        id: "timeEnabledLayer",
        url: layerSelect.value,
        opacity: 0.6,
        definitionExpression: "after_time = " + afterTime,
        visible: true
      });
    }
    map.add(timeEnabledLayer);
    view.whenLayerView(timeEnabledLayer).then((lv) => {
      document.getElementById("viewDiv").style.cursor = "auto";
      //console.log("timeEnabledLayer.rasterFunctionInfos:", timeEnabledLayer.rasterFunctionInfos[0].name);
      if (zoom2layer) {
        zoom2layer = false;
        view.goTo({
          target:timeEnabledLayer.fullExtent
        },{
          duration: 1000
        });
      }
      timeSlider.fullTimeExtent = timeEnabledLayer.timeInfo.fullTimeExtent;
      if (timeSlider.timeExtent) {
        if (timeSlider.timeExtent.start < timeSlider.fullTimeExtent.start) {
          timeSlider.timeExtent = {start: timeSlider.fullTimeExtent.start, end: timeSlider.fullTimeExtent.start};
        } else if (timeSlider.timeExtent.start > timeSlider.fullTimeExtent.end) {
          timeSlider.timeExtent = {start: timeSlider.fullTimeExtent.end, end: timeSlider.fullTimeExtent.end};
        }
      }
      timeSlider.stops = {
        interval: timeEnabledLayer.timeInfo.interval
      };
      document.getElementById("timeView").style.display = "block";
      document.getElementById("timeslider_box").style.display = "block";
      timeSlider.watch("timeExtent", (timeExtent) => {
        document.getElementById("timeView").innerHTML = timeExtent.start.toLocaleString('ja-JP');
        if (view.popup.visible) {
          identify4popup(clickedMapPoint);
        }
      });
      if (view.popup.visible) {
        identify4popup(clickedMapPoint);
      }  
      //凡例の更新
      legendList.forEach(legend => {
        let legendLayerName = "";
        if(timeEnabledLayer.rasterFunctionInfos){
          legendLayerName = timeEnabledLayer.rasterFunctionInfos[0].name;
        } else {
          legendLayerName = timeEnabledLayer.title;
        }
        if (legend[0] === legendLayerName) {
          popupTitle = legend[1];
          popupUnit = legend[2];
          document.getElementById("legendFrame").contentWindow.document.querySelectorAll(".legendDiv_" + legend[0]).forEach(legendDiv => {
            legendDiv.style.display = "block";
          });
        } else {
          document.getElementById("legendFrame").contentWindow.document.querySelectorAll(".legendDiv_" + legend[0]).forEach(legendDiv => {
            legendDiv.style.display = "none";
          });
        }
      });
    });
  });
  function removeOptions(x) {
    if (x.hasChildNodes()) {
      while (x.childNodes.length > 2) {
        x.removeChild(x.lastChild);
      }
    }
  }

  view.when(function(){
    if (view.widthBreakpoint === "xsmall") {
      legendExpand.visible = false;
      document.getElementById("legendModalButton").style.display = "block";
    } else {
      legendExpand.visible = true;
      document.getElementById("legendModalButton").style.display = "none";
    }
  });

  //現況と予測値の切り替え
  view.ui.add(layerRadioGroup, "top-right");
  view.ui.move("zoom", "top-left");
  let afterTime = 0;
  layerRadioGroup.addEventListener("calciteRadioGroupChange", (event) => {
    //console.log("event.detail:", event.detail);
    afterTime = event.detail;
    timeEnabledLayer.definitionExpression = "after_time = " + afterTime;
    if (view.popup.visible) {
      identify4popup(clickedMapPoint);
    }
  });

  //ポップアップ表示
  let clickedMapPoint;
  view.on("click", function (event) {
    clickedMapPoint = event.mapPoint;
    identify4popup(clickedMapPoint);
  });
  function identify4popup(mapPoint) {
    if (timeEnabledLayer.type === "imagery") {
      let imageIdentifyParams = new ImageIdentifyParameters();
      imageIdentifyParams.geometry = mapPoint;
      imageIdentifyParams.timeExtent = timeSlider.timeExtent;
      imageIdentifyParams.mosaicRule = {where: "after_time = " + afterTime};
      imageIdentifyParams.renderingRule = {}; //response.valueがRGB("236, 236, 138")となるのを回避するため
      const popup = view.popup;
      if (timeEnabledLayer && timeEnabledLayer.visible) {
        timeEnabledLayer.identify(imageIdentifyParams).then(function (response) {
          if(response.value != "NoData") {
            popup.open({
              title: popupTitle + "：" + Math.round(response.value * 10) / 10 + popupUnit
            });
          } else {
            popup.clear();
          }
        });
      }
    }
    if (timeEnabledLayer.type === "map-image") {
      //MapImageLayerの場合のポップアップ設定は未実装
    }
  }

  //凡例（説明）
  const legendExpand = new Expand({
    visible: false,
    expandIconClass: "esri-icon-legend",
    expandTooltip: "説明",
    expanded: false,
    view: view,
    content: document.getElementById("infoDiv")
  });
  view.ui.add(legendExpand, "top-right");
  view.ui.add(legendModalButton, "top-right");

  view.watch("widthBreakpoint", function(newVal){
    if (newVal === "xsmall") {
      legendExpand.visible = false;
      document.getElementById("legendModalButton").style.display = "block";
    } else {
      legendExpand.visible = true;
      document.getElementById("legendModalButton").style.display = "none";
    }
  });

  /** 凡例（スマホ用） */
  document.getElementById("legendModalButton").onclick = () => { document.getElementById("legendModal").active = true; }
  document.getElementById("closeLegendModalButton").onclick = () => { document.getElementById("legendModal").active = false; }

});
